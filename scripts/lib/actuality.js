// scripts/lib/actuality.js
import { cleanText } from "./text.js";
import { extractTimelyClaimsAI, actualityCheckAI } from "./ai.js";
import { fetchText, parseRssItems } from "./rss.js";

export async function fetchRecentHeadlines(NEWS_RSS, query, limit = 8) {
  const xml = await fetchText(NEWS_RSS(query));
  return parseRssItems(xml).slice(0, limit).map((x) => cleanText(x.title)).filter(Boolean);
}

export async function runActualityChecksOrExplain(ctx, { title, subtitle, content, NEWS_RSS }) {
  const claims = await extractTimelyClaimsAI(ctx, {
    articleTitle: title,
    articleSubtitle: subtitle,
    articleContent: content,
  });

  for (const c of claims) {
    const claimText = cleanText(c?.claim || "");
    const q = cleanText(c?.query || "");
    if (!claimText || !q) continue;

    let headlines = [];
    try { headlines = await fetchRecentHeadlines(NEWS_RSS, q, 8); } catch { continue; }
    if (headlines.length === 0) continue;

    const verdict = await actualityCheckAI(ctx, { claim: claimText, headlines });
    if (verdict?.ok === false) {
      return {
        ok: false,
        failed_claim: claimText,
        reason: cleanText(verdict?.reason || "Verouderde claim"),
        rewrite_instructions: cleanText(verdict?.rewrite_instructions || ""),
        sample_headline: headlines[0] || "",
      };
    }
  }

  return { ok: true };
}
