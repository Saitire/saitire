// functions/api/comments.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function cleanSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, "");
}

function clamp(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n) : t;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = cleanSlug(url.searchParams.get("slug"));
  if (!slug) return json({ error: "Missing slug" }, 400, CORS);

  if (!env.COMMENTS_BUCKET) {
    return json({ error: "COMMENTS_BUCKET binding missing" }, 500, CORS);
  }

  const key = `comments/${slug}.json`;
  const obj = await env.COMMENTS_BUCKET.get(key);

  if (!obj) return json({ comments: [] }, 200, CORS);

  let data = {};
  try {
    data = JSON.parse(await obj.text());
  } catch {
    data = {};
  }

  const comments = Array.isArray(data.comments) ? data.comments : [];
  return json({ comments }, 200, CORS);
}

export async function onRequestPost({ request, env }) {
  if (!env.COMMENTS_BUCKET) {
    return json({ error: "COMMENTS_BUCKET binding missing" }, 500, CORS);
  }

  const body = await request.json().catch(() => ({}));

  const slug = cleanSlug(body?.slug);
  const name = clamp(body?.name || "Anoniem", 40) || "Anoniem";
  const text = clamp(body?.text, 1200);
  const parent_id = body?.parent_id ? String(body.parent_id) : null;

  if (!slug) return json({ error: "Missing slug" }, 400, CORS);
  if (!text || text.length < 3) return json({ error: "Text too short" }, 400, CORS);

  const key = `comments/${slug}.json`;

  // load existing
  let comments = [];
  const obj = await env.COMMENTS_BUCKET.get(key);
  if (obj) {
    try {
      const data = JSON.parse(await obj.text());
      comments = Array.isArray(data.comments) ? data.comments : [];
    } catch {
      comments = [];
    }
  }

  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    slug,
    parent_id,
    name,
    text,
    created_at: now,
  };

  comments.unshift(item);
  comments = comments.slice(0, 500); // cap

  await env.COMMENTS_BUCKET.put(key, JSON.stringify({ comments }), {
    httpMetadata: { contentType: "application/json" },
  });

  return json({ ok: true, comments }, 200, CORS);
}
