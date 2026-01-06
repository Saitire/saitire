/**
 * scripts/editor.js
 *
 * Eindredacteur / hoofdredacteur:
 * - Hard reject ALLEEN als bronkop/titel/subtitle duidelijke ernstige signalen bevatten
 *   (geen body/content check -> voorkomt dat satire-woorden per ongeluk alles blokkeren)
 * - Daarna AI-kwaliteitsreview (grappig, ludiek, ritme, punchline)
 * - Schrijft review JSON naar /reviews/<article_id>.json
 *
 * Vereist:
 * - npm i openai dotenv
 * - .env met OPENAI_API_KEY=...
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const REVIEW_DIR = path.join(process.cwd(), "reviews");
const REVIEW_MODEL = "gpt-4.1-mini"; // voor kwaliteit; je kunt dit later naar "gpt-4.1" zetten

function formatReviewId(article) {
  return article.id || article.slug || String(Date.now());
}

function clampScore(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function extractJson(text) {
  let cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Strakke "ernstig"-detectie voor koppen:
 * Alleen duidelijke, expliciete patronen (woordgrenzen) -> veel minder false positives.
 * Dit gebruik je op source_headline + title + subtitle.
 */
function isSeriousTopicTitle(text) {
  const t = String(text || "").toLowerCase();

  const HARD_PATTERNS = [
    /\bern(?:stig)?\s+gewond\b/i,
    /\bzwaargewond\b/i,
    /\bkritieke\s+toestand\b/i,
    /\bop\s+de\s+ic\b/i,
    /\bintensive\s+care\b/i,
    /\bcoma\b/i,

    /\boverleden\b/i,
    /\bom\s+het\s+leven\s+gekomen\b/i,
    /\bdodelijk\b/i,

    /\baanslag\b/i,
    /\bterror(?:isme|ist)?\b/i,
    /\bschietpartij\b/i,
    /\bsteekpartij\b/i,
    /\bgijzel(?:ing|aar)?\b/i,

    /\bzelfmoord\b/i,
    /\bsu[iï]cide\b/i,

    /\bverkracht(?:ing)?\b/i,
    /\bseksueel\s+misbruik\b/i,
  ];

  return HARD_PATTERNS.some((re) => re.test(t));
}

function hasSeriousSignalsInHeadlines(article) {
  // ✅ alleen kop/metadata; NIET body/content
  const source = String(article?.source_headline || "");
  const title = String(article?.title || "");
  const subtitle = String(article?.subtitle || "");

  const combo = `${source} | ${title} | ${subtitle}`.trim();
  return isSeriousTopicTitle(combo);
}

async function aiQualityReview(article) {
  const sourceHeadline = String(article.source_headline || "");
  const title = String(article.title || "");
  const subtitle = String(article.subtitle || "");
  const body = String(article.body || article.content || "");
  const category = String(article.category || "");
  const author = String(article.author || article.editor_name || "");

  const prompt = `
Je bent de EINDREDACTEUR van een ludieke satirische nieuwssite.

Doel:
- Plaats alleen artikelen die echt ludiek en grappig zijn.
- Niet gemeen, niet ongemakkelijk, niet uitleggerig.

Belangrijk:
- Ernst-check is al gedaan op bronkop/titel/subtitle. De body kan "ernstige woorden" bevatten als grap.
- Jij beoordeelt nu vooral kwaliteit, humor en ritme.

Input:
- source_headline: "${sourceHeadline}"
- category: "${category}"
- author: "${author}"

Artikel:
TITLE: "${title}"
SUBTITLE: "${subtitle}"
BODY:
${body}

Beoordeel streng op:
1) Eerste zin: meteen grappig (geen aanloop).
2) Ludiek: hard op systemen/gedrag, niet op kwetsbare personen.
3) Ritme: korte alinea’s met witregels, geen opsommingen/kopjes.
4) Escalatie: steeds absurder, maar logisch binnen het eigen universum.
5) Punchline: droog, abrupt, laatste alinea.

Geef score 0-100 en keur alleen goed als score >= 75.

Output: ALLEEN geldige JSON exact in dit schema:
{
  "approved": true/false,
  "score": 0-100,
  "reasons": ["...max 5 korte redenen..."],
  "must_fix": ["...max 5 concrete fixes..."],
  "rewrite_prompt": "korte instructie voor herschrijven (leeg als approved=true)"
}
`.trim();

  const res = await openai.chat.completions.create({
    model: REVIEW_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = res.choices?.[0]?.message?.content || "";
  const data = extractJson(raw);

  const score = clampScore(data?.score);
  const approved = !!data?.approved && score >= 75;

  return {
    approved,
    score,
    reasons: Array.isArray(data?.reasons) ? data.reasons.map(String).slice(0, 5) : [],
    must_fix: Array.isArray(data?.must_fix) ? data.must_fix.map(String).slice(0, 5) : [],
    rewrite_prompt: approved ? "" : String(data?.rewrite_prompt || "").slice(0, 2000),
  };
}

export async function reviewArticle(article) {
  // 1) Hard reject op duidelijke ernstige signalen in bronkop/titel/subtitle
  if (hasSeriousSignalsInHeadlines(article)) {
    const review = {
      article_id: formatReviewId(article),
      approved: false,
      score: 0,
      reasons: [
        "Niet ludiek geschikt: bronkop/titel/subtitle bevat duidelijke ernstige signalen (letselschade/doden/geweld/etc.).",
      ],
      must_fix: [],
      rewrite_prompt: "",
      timestamp: new Date().toISOString(),
    };

    await fs.mkdir(REVIEW_DIR, { recursive: true });
    await fs.writeFile(
      path.join(REVIEW_DIR, `${review.article_id}.json`),
      JSON.stringify(review, null, 2),
      "utf-8"
    );

    return review;
  }

  // 2) AI kwaliteitsreview
  const result = await aiQualityReview(article);

  const review = {
    article_id: formatReviewId(article),
    ...result,
    timestamp: new Date().toISOString(),
  };

  await fs.mkdir(REVIEW_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REVIEW_DIR, `${review.article_id}.json`),
    JSON.stringify(review, null, 2),
    "utf-8"
  );

  return review;
}
