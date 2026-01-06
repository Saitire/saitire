// scripts/lib/json.js
export function safeExtractJson(text, fallback) {
  try { return extractJson(text); } catch { return fallback; }
}

export function extractJson(text) {
  let cleaned = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}
