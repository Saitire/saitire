// scripts/lib/peopleFilter.js
import { fetchText, parseRssItems } from "./rss.js";
import { cleanText } from "./text.js";

export function isSeriousTopicTitle(title) {
  const t = String(title || "").toLowerCase();
  const HARD_PATTERNS = [
    /\bern(?:stig)?\s+gewond\b/i, /\bzwaargewond\b/i, /\bkritieke\s+toestand\b/i,
    /\boverleden\b/i, /\bom\s+het\s+leven\s+gekomen\b/i, /\bdodelijk\b/i,
    /\baanslag\b/i, /\bterror(?:isme|ist)?\b/i, /\bschietpartij\b/i, /\bsteekpartij\b/i,
    /\bgijzel(?:ing|aar)?\b/i, /\bzelfmoord\b/i, /\bsu[iï]cide\b/i,
    /\bverkracht(?:ing)?\b/i, /\bseksueel\s+misbruik\b/i,
  ];
  return HARD_PATTERNS.some((re) => re.test(t));
}

export async function hasSeriousRecentNewsAboutPeople({ people, NEWS_RSS }) {
  if (!people || people.length === 0) return { hit: false, who: "", reason: "" };

  for (const person of people) {
    try {
      const xml = await fetchText(NEWS_RSS(person));
      const items = parseRssItems(xml).slice(0, 10);
      const titles = items.map((x) => cleanText(x.title)).filter(Boolean);

      const seriousTitle = titles.find(isSeriousTopicTitle);
      if (seriousTitle) {
        return {
          hit: true,
          who: person,
          reason: `Ernstig nieuws-signaal gevonden over "${person}" (bijv. "${seriousTitle}")`,
        };
      }
    } catch {}
  }

  return { hit: false, who: "", reason: "" };
}
