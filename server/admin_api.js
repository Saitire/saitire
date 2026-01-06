import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// projectroot = 1 map omhoog vanaf /server
const ROOT = path.join(__dirname, "..");

const PENDING_PATH = path.join(ROOT, "reviews", "pending.json");
const OUT_PATH = path.join(ROOT, "public", "articles.json");
const FEEDBACK_PATH = path.join(ROOT, "reviews", "feedback.jsonl");

// comments opslag
const COMMENTS_PATH = path.join(ROOT, "data", "comments.json");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const ALLOW_PUBLIC_COMMENTS = String(process.env.ALLOW_PUBLIC_COMMENTS || "true") === "true";

// anti-spiral caps
const MAX_COMMENTS_PER_ARTICLE = 300;
const MAX_DEPTH = 3; // max nesting (0 = top-level, 1 = reply, etc.)
const MAX_CHILDREN_PER_PARENT = 60;

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw || JSON.stringify(fallback));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function appendJsonl(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(obj) + "\n", "utf8");
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Bad token" });
  }
}

function normSlug(slug) {
  return String(slug || "").trim().toLowerCase();
}

function clampText(s, max) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

function findComment(list, id) {
  return (list || []).find((c) => c && c.id === id) || null;
}

function computeDepth(list, comment) {
  // top-level => 0
  let depth = 0;
  let cur = comment;
  const seen = new Set();
  while (cur && cur.parent_id) {
    if (seen.has(cur.parent_id)) break; // cycle guard
    seen.add(cur.parent_id);

    const parent = findComment(list, cur.parent_id);
    if (!parent) break;
    depth += 1;
    cur = parent;
    if (depth > 20) break;
  }
  return depth;
}

function countChildren(list, parentId) {
  return (list || []).filter((c) => c && c.parent_id === parentId).length;
}

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Login
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD || !JWT_SECRET) return res.status(500).json({ error: "Server not configured" });
  if (String(password || "") !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
});

// List pending
app.get("/api/pending", auth, (_req, res) => {
  const pending = readJson(PENDING_PATH, []);
  res.json({ pending });
});

// List published
app.get("/api/published", auth, (_req, res) => {
  const published = readJson(OUT_PATH, []);
  res.json({ published });
});

// Delete published
app.post("/api/delete_published", auth, (req, res) => {
  const { id, slug } = req.body || {};
  const published = readJson(OUT_PATH, []);

  const idx = published.findIndex((a) => (id && a.id === id) || (slug && a.slug === slug));
  if (idx === -1) return res.status(404).json({ error: "Not found in published" });

  const item = published[idx];
  published.splice(idx, 1);
  writeJson(OUT_PATH, published);

  appendJsonl(FEEDBACK_PATH, {
    at: new Date().toISOString(),
    action: "delete_published",
    id: item.id,
    slug: item.slug,
    title: item.title,
    source_headline: item.source_headline,
    category: item.category || null,
    editor_id: item.editor_id || null,
    editor_name: item.editor_name || item.author || null,
    editor_role: item.editor_role || null,
  });

  res.json({ ok: true });
});

// Approve -> move to public/articles.json
app.post("/api/approve", auth, (req, res) => {
  const { id, slug } = req.body || {};
  const pending = readJson(PENDING_PATH, []);
  const idx = pending.findIndex((a) => (id && a.id === id) || (slug && a.slug === slug));
  if (idx === -1) return res.status(404).json({ error: "Not found in pending" });

  const item = pending[idx];
  pending.splice(idx, 1);
  writeJson(PENDING_PATH, pending);

  const published = readJson(OUT_PATH, []);
  item.review_status = "approved_by_human";
  item.reviewed_at = new Date().toISOString();
  published.unshift(item);
  writeJson(OUT_PATH, published);

  res.json({ ok: true });
});

// Reject -> remove from pending + log feedback
app.post("/api/reject", auth, (req, res) => {
  const { id, slug, feedback } = req.body || {};
  const pending = readJson(PENDING_PATH, []);
  const idx = pending.findIndex((a) => (id && a.id === id) || (slug && a.slug === slug));
  if (idx === -1) return res.status(404).json({ error: "Not found in pending" });

  const item = pending[idx];
  pending.splice(idx, 1);
  writeJson(PENDING_PATH, pending);

  appendJsonl(FEEDBACK_PATH, {
    at: new Date().toISOString(),
    action: "reject",
    id: item.id,
    slug: item.slug,
    title: item.title,
    source_headline: item.source_headline,

    category: item.category || null,
    editor_id: item.editor_id || null,
    editor_name: item.editor_name || item.author || null,
    editor_role: item.editor_role || null,

    ai_score: item.review_score ?? null,
    ai_notes: item.review_notes ?? [],
    feedback: String(feedback || "").trim(),
  });

  res.json({ ok: true });
});

//
// -------------------- COMMENTS (publiek) --------------------
//

app.get("/api/comments/:slug", (req, res) => {
  const slug = normSlug(req.params.slug);
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const db = readJson(COMMENTS_PATH, {});
  const list = Array.isArray(db[slug]) ? db[slug] : [];
  res.json({ slug, comments: list });
});

/**
 * POST /api/comments
 * body: { slug, name?, text, parent_id? }
 */
app.post("/api/comments", (req, res) => {
  if (!ALLOW_PUBLIC_COMMENTS) return res.status(403).json({ error: "Comments disabled" });

  const { slug, name, text, parent_id } = req.body || {};
  const s = normSlug(slug);
  const n = clampText(name || "Anoniem", 40) || "Anoniem";
  const t = clampText(text, 1200);
  const pid = parent_id ? String(parent_id).trim() : null;

  if (!s) return res.status(400).json({ error: "Missing slug" });
  if (!t || t.length < 3) return res.status(400).json({ error: "Comment too short" });

  const db = readJson(COMMENTS_PATH, {});
  if (!Array.isArray(db[s])) db[s] = [];
  const list = db[s];

  // caps
  if (list.length >= MAX_COMMENTS_PER_ARTICLE) {
    return res.status(429).json({ error: "Too many comments for this article" });
  }

  // reply validation
  if (pid) {
    const parent = findComment(list, pid);
    if (!parent) return res.status(400).json({ error: "Parent not found" });

    const depth = computeDepth(list, parent) + 1;
    if (depth > MAX_DEPTH) {
      return res.status(400).json({ error: "Reply nesting too deep" });
    }

    if (countChildren(list, pid) >= MAX_CHILDREN_PER_PARENT) {
      return res.status(429).json({ error: "Too many replies on this comment" });
    }
  }

  const comment = {
    id: crypto.randomUUID(),
    slug: s,
    parent_id: pid, // null = top-level
    name: n,
    text: t,
    created_at: new Date().toISOString(),
  };

  // nieuwste eerst
  list.unshift(comment);
  db[s] = list;

  writeJson(COMMENTS_PATH, db);
  res.json({ ok: true, comment });
});

// Admin: lijst alle comments (moderatie)
app.get("/api/comments", auth, (_req, res) => {
  const db = readJson(COMMENTS_PATH, {});
  res.json({ commentsBySlug: db });
});

// Admin: delete comment (ook replies blijven bestaan; UI kan "verwijderd" label tonen later)
app.post("/api/comments/delete", auth, (req, res) => {
  const { slug, id } = req.body || {};
  const s = normSlug(slug);
  const cid = String(id || "").trim();
  if (!s || !cid) return res.status(400).json({ error: "Missing slug/id" });

  const db = readJson(COMMENTS_PATH, {});
  const list = Array.isArray(db[s]) ? db[s] : [];
  const idx = list.findIndex((c) => c.id === cid);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const removed = list[idx];
  list.splice(idx, 1);
  db[s] = list;
  writeJson(COMMENTS_PATH, db);

  appendJsonl(FEEDBACK_PATH, {
    at: new Date().toISOString(),
    action: "delete_comment",
    slug: s,
    comment_id: removed.id,
    comment_name: removed.name,
    comment_text: removed.text,
  });

  res.json({ ok: true });
});

const PORT = process.env.ADMIN_API_PORT ? Number(process.env.ADMIN_API_PORT) : 5179;
app.listen(PORT, () => {
  console.log(`Admin API running on http://localhost:${PORT}`);
  console.log(`Public comments: ${ALLOW_PUBLIC_COMMENTS ? "ON" : "OFF"}`);
});
