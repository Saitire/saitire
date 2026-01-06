// scripts/lib/text.js
export function cleanText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function isTooGeneric(t) {
  const low = String(t || "").toLowerCase().trim();
  const banned = ["weer", "nieuws", "update", "live", "today", "vandaag", "breaking"];
  if (banned.includes(low)) return true;
  if (low.length <= 2) return true;
  if (!/[a-zA-ZÀ-ÿ]/.test(t)) return true;
  return false;
}

export function fallbackTitle(trend) {
  return `Nederland reageert op “${trend}” met een mix van urgentie en uitstel`;
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function extractReadableTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeParagraphs(text, { minSentences = 2, maxSentences = 4 } = {}) {
  const s = String(text || "").trim();
  if (!s) return "";

  const flattened = s.replace(/\r/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const sentences = flattened
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (sentences.length === 0) return "";

  const paragraphs = [];
  let i = 0;

  while (i < sentences.length) {
    const remaining = sentences.length - i;
    let take = 3;
    if (remaining === 2) take = 2;
    if (remaining === 4) take = 4;
    if (remaining < minSentences) take = remaining;

    take = Math.max(minSentences, Math.min(maxSentences, take));
    take = Math.min(take, remaining);

    paragraphs.push(sentences.slice(i, i + take).join(" "));
    i += take;
  }

  return paragraphs.join("\n\n").trim();
}

export function normalizeInvestigationMarkdown(text) {
  const s = String(text || "").replace(/\r/g, "").trim();
  if (!s) return "";
  const lines = s.split("\n").map((l) => l.replace(/[ \t]+$/g, ""));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function trimToMaxWordsPreserveParagraphs(text, maxWords) {
  const s = String(text || "").trim();
  if (!s) return "";

  const parts = s.split("\n\n");
  const out = [];
  let count = 0;

  for (const p of parts) {
    const words = p.split(/\s+/).filter(Boolean);
    if (count + words.length <= maxWords) {
      out.push(p);
      count += words.length;
      continue;
    }
    const remaining = maxWords - count;
    if (remaining > 0) out.push(words.slice(0, remaining).join(" ") + "…");
    break;
  }

  return out.join("\n\n").trim();
}

export function removeAuthorSignature(text) {
  return String(text || "").replace(/\n{1,2}—\s*[^\n]{1,80}\s*$/s, "").trim();
}
