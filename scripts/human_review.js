/**
 * Human review queue
 * Gebruik:
 *   node scripts/human_review.js list
 *   node scripts/human_review.js show 0
 *   node scripts/human_review.js approve 0
 *   node scripts/human_review.js reject 0 "jouw feedback..."
 */

import fs from "node:fs";
import path from "node:path";

const PENDING_PATH = path.join(process.cwd(), "reviews", "pending.json");
const OUT_PATH = path.join(process.cwd(), "public", "articles.json");
const FEEDBACK_PATH = path.join(process.cwd(), "reviews", "feedback.jsonl");

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8") || JSON.stringify(fallback));
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}
function appendLine(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(obj) + "\n", "utf8");
}

const [cmd, idxRaw, ...rest] = process.argv.slice(2);
const pending = readJson(PENDING_PATH, []);
const existing = readJson(OUT_PATH, []);

if (cmd === "list") {
  pending.slice(0, 20).forEach((a, i) => {
    console.log(
      `${i}) [${a.review_score ?? "?"}] ${a.category} | ${a.title} (${a.slug})`
    );
  });
  process.exit(0);
}

const idx = Number(idxRaw);
if (!Number.isFinite(idx) || idx < 0 || idx >= pending.length) {
  console.log("Index ongeldig. Gebruik: list / show <i> / approve <i> / reject <i> \"feedback\"");
  process.exit(1);
}

const item = pending[idx];

if (cmd === "show") {
  console.log(`\nTITLE: ${item.title}`);
  console.log(`SUB:   ${item.subtitle}`);
  console.log(`CAT:   ${item.category}`);
  console.log(`SCORE: ${item.review_score}`);
  console.log(`NOTES: ${(item.review_notes || []).join(" | ")}`);
  console.log("\nCONTENT:\n");
  console.log(item.content);
  console.log("\n");
  process.exit(0);
}

if (cmd === "approve") {
  item.review_status = "approved_by_human";
  existing.unshift(item);
  pending.splice(idx, 1);

  writeJson(OUT_PATH, existing);
  writeJson(PENDING_PATH, pending);

  console.log(`Approved & gepubliceerd: ${item.slug}`);
  process.exit(0);
}

if (cmd === "reject") {
  const feedback = rest.join(" ").trim();
  item.review_status = "rejected_by_human";

  appendLine(FEEDBACK_PATH, {
    at: new Date().toISOString(),
    slug: item.slug,
    title: item.title,
    score: item.review_score,
    notes: item.review_notes || [],
    feedback,
  });

  pending.splice(idx, 1);
  writeJson(PENDING_PATH, pending);

  console.log(`Rejected. Feedback opgeslagen in reviews/feedback.jsonl`);
  process.exit(0);
}

console.log("Onbekend commando. Gebruik: list/show/approve/reject");
process.exit(1);
