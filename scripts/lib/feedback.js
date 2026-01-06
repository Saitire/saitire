// scripts/lib/feedback.js
import fs from "node:fs";

export function readLastJsonlLines(p, maxLines = 200) {
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split("\n").filter(Boolean);
  const tail = lines.slice(-maxLines);
  const out = [];
  for (const line of tail) {
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

export function buildFeedbackContext({ rows, category, editor_id, editor_name, maxGlobal, maxCategory, maxEditor }) {
  const cat = String(category || "").trim().toLowerCase();
  const eid = String(editor_id || "").trim();
  const ename = String(editor_name || "").trim();

  const relevant = (rows || [])
    .filter(r => r && r.action === "reject" && String(r.feedback || "").trim())
    .slice()
    .reverse();

  const global = [];
  const catRules = [];
  const editorRules = [];

  const seen = new Set();

  function pushUnique(arr, txt, cap) {
    const key = txt.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    arr.push(`- ${txt}`);
    return arr.length >= cap;
  }

  for (const r of relevant) {
    const fb = String(r.feedback || "").trim();
    if (!fb) continue;

    const rCat = String(r.category || "").trim().toLowerCase();
    const rEid = String(r.editor_id || "").trim();
    const rEname = String(r.editor_name || "").trim();

    const matchesCategory = cat && rCat && rCat === cat;
    const matchesEditor = (eid && rEid && rEid === eid) || (ename && rEname && rEname === ename);

    if (matchesEditor) {
      pushUnique(editorRules, fb, maxEditor);
    } else if (matchesCategory) {
      pushUnique(catRules, fb, maxCategory);
    } else {
      pushUnique(global, fb, maxGlobal);
    }

    if (global.length >= maxGlobal && catRules.length >= maxCategory && editorRules.length >= maxEditor) break;
  }

  const parts = [];
  if (editorRules.length) parts.push(`EDITOR (${editor_name || editor_id}):\n${editorRules.join("\n")}`);
  if (catRules.length) parts.push(`CATEGORIE (${category}):\n${catRules.join("\n")}`);
  if (global.length) parts.push(`ALGEMEEN:\n${global.join("\n")}`);

  return parts.join("\n\n");
}
