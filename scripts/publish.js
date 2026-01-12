// scripts/publish.js
import "dotenv/config";
import path from "node:path";
import crypto from "node:crypto";
import OpenAI from "openai";

import editors from "../src/data/editors.json" with { type: "json" };

import {
  parseArgs,
  toInt,
  readJsonArray,
  readJson,
  writeJson,
  writeJsonFile,
} from "./lib/io.js";

import { fetchText, parseRssItems } from "./lib/rss.js";

import {
  cleanText,
  slugify,
  isTooGeneric,
  fallbackTitle,
  extractReadableTextFromHtml,
  normalizeParagraphs,
  normalizeInvestigationMarkdown,
  removeAuthorSignature,
} from "./lib/text.js";

import { weightedPick } from "./lib/pick.js";
import { readLastJsonlLines, buildFeedbackContext } from "./lib/feedback.js";
import { applyFeaturedRules } from "./lib/featured.js";
import { countInvestigationsToday } from "./lib/date.js";

import {
  generateSocietalPulseHookAI,
  summarizeSourceArticleAI,
  isLudicSuitableAI,
  classifyCategoryAI,
  generateArticle,
  extractPersonNamesAI,
  writersRoomNotesAI,
  punchUpRewriteAI,
  finalEditorPassAI,
} from "./lib/ai.js";

import { runActualityChecksOrExplain } from "./lib/actuality.js";
import { hasSeriousRecentNewsAboutPeople } from "./lib/peopleFilter.js";
import { getArticleImage } from "./imageProviders.js";

// -------------------- CONFIG --------------------
const GEO = "NL";

// Models
const WRITE_MODEL = process.env.WRITE_MODEL || "gpt-4.1";
const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL || "gpt-4.1-mini";
const FILTER_MODEL = process.env.FILTER_MODEL || "gpt-4.1-mini";
const WRITE_TEMPERATURE = toNumber(process.env.WRITE_TEMPERATURE, 0.9);

// Volume
const LIMIT_DEFAULT = 3;
const NEWS_PER_TREND_DEFAULT = 3;

// Human review (default: everything goes to pending)
const HUMAN_REVIEW_MODE = (process.env.HUMAN_REVIEW_MODE ?? "1") === "1";
const FORCE_ALL_TO_PENDING = (process.env.FORCE_ALL_TO_PENDING ?? "1") === "1";
const HUMAN_REVIEW_SCORE_BELOW = toNumber(process.env.HUMAN_REVIEW_SCORE_BELOW, 85);

// Notifications (optional)
const REVIEW_WEBHOOK_URL = process.env.REVIEW_WEBHOOK_URL || "";
const REVIEW_DASHBOARD_URL = process.env.REVIEW_DASHBOARD_URL || "";

// Paths
const OUT_PATH = path.join(process.cwd(), "public", "articles.json");
const PENDING_PATH = path.join(process.cwd(), "reviews", "pending.json");
const FEEDBACK_PATH = path.join(process.cwd(), "reviews", "feedback.jsonl");

// RSS
const TRENDS_RSS = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(GEO)}`;
const NEWS_RSS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=nl&gl=NL&ceid=NL:nl`;

// Featured
const MAX_FEATURED = 4;
const FEATURED_TTL_HOURS = 12;
const FEATURED_CATEGORIES = ["politiek", "tech", "buitenland"];

// Modes/types
const TOPIC_MODE_WEIGHTS = { trending: 0.7, societal_pulse: 0.3 };
const ARTICLE_TYPE_WEIGHTS = { normal: 0.5, short: 0.5, investigation: 0.08 };
const MAX_INVESTIGATIONS_PER_DAY = 1;

// Source summary
const SOURCE_SUMMARY_MAX_BULLETS = 4;
const SOURCE_TEXT_MAX_CHARS_FOR_AI = 4000;

// Feedback usage
const FEEDBACK_LOOKBACK_LINES = 400;
const FEEDBACK_MAX_GLOBAL = 6;
const FEEDBACK_MAX_CATEGORY = 6;
const FEEDBACK_MAX_EDITOR = 6;

// Images
const IMAGE_MODE = process.env.IMAGE_MODE || "gen"; // "web" | "gen" | "off"
const IMAGE_WIDTHS = { thumb: 200, small: 480, medium: 800, large: 1200 };

// -------------------- BOOT --------------------
const args = parseArgs(process.argv.slice(2));
const FORCE = !!args.force;
const DRY_RUN = !!args["dry-run"];
const LIMIT = toInt(args.limit, LIMIT_DEFAULT);
const NEWS_PER_TREND = toInt(args.news_per_trend, NEWS_PER_TREND_DEFAULT);
const FORCE_INVESTIGATION = !!args.investigation;

// ✅ toggles
const SKIP_REVIEW = !!args["no-review"] || (process.env.ENABLE_REVIEW ?? "1") === "0";
const NO_OPENAI = !!args["no-openai"] || (process.env.ENABLE_OPENAI ?? "1") === "0";

// ✅ OpenAI is required for writing pipeline; we only allow NO_OPENAI in DRY_RUN
const needsOpenAIForWork = !NO_OPENAI && !!process.env.OPENAI_API_KEY;
if (!NO_OPENAI && !process.env.OPENAI_API_KEY) {
  // we still fail early, but only here (not in editor.js import time)
  throw new Error("OPENAI_API_KEY ontbreekt. Zet deze in je .env of draai met --dry-run --no-openai.");
}

const openai = NO_OPENAI ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const aiCtx = {
  openai,
  WRITE_MODEL,
  CLASSIFY_MODEL,
  FILTER_MODEL,
  WRITE_TEMPERATURE,
  SOURCE_SUMMARY_MAX_BULLETS,
  SOURCE_TEXT_MAX_CHARS_FOR_AI,
};

main().catch((e) => {
  console.error("FOUT:", e?.stack || e);
  process.exit(1);
});

async function main() {
  console.log("== SAItire Publisher ==");
  console.log("Geo:", GEO);
  console.log("Write model:", WRITE_MODEL, "| temp:", WRITE_TEMPERATURE);
  console.log("Classify/Filter model:", CLASSIFY_MODEL, "/", FILTER_MODEL);
  console.log("Limit:", LIMIT, "| Mode:", DRY_RUN ? "DRY-RUN" : "WRITE");
  console.log("Force:", FORCE ? "ON" : "OFF");
  console.log("Force investigation:", FORCE_INVESTIGATION ? "ON" : "OFF");
  console.log("Images:", IMAGE_MODE);
  console.log("OpenAI:", NO_OPENAI ? "OFF" : "ON");
  console.log("Review:", SKIP_REVIEW ? "SKIP (--no-review / ENABLE_REVIEW=0)" : "ON");
  console.log(
    "Human review:",
    HUMAN_REVIEW_MODE
      ? FORCE_ALL_TO_PENDING
        ? "ON (ALL => pending)"
        : `ON (<${HUMAN_REVIEW_SCORE_BELOW} or reject => pending)`
      : "OFF"
  );
  console.log("");

  // ✅ allow "no-openai" only for dry-run (so you can test RSS, parsing, flow)
  if (NO_OPENAI && !DRY_RUN) {
    throw new Error("OPENAI staat uit. Draai met --dry-run --no-openai, of zet ENABLE_OPENAI=1 + OPENAI_API_KEY.");
  }

  const existing = readJsonArray(OUT_PATH);
  const existingSlugs = new Set(existing.map((a) => a.slug).filter(Boolean));
  const existingSources = new Set(existing.map((a) => a.source_url).filter(Boolean));

  // quota: only published items count (existing + approved new)
  const allForQuota = [...existing];

  // feedback
  const feedbackRows = readLastJsonlLines(FEEDBACK_PATH, FEEDBACK_LOOKBACK_LINES);

  // trends
  const trendsXml = await fetchText(TRENDS_RSS);
  const trends = parseRssItems(trendsXml)
    .map((x) => cleanText(x.title))
    .filter((t) => t && !isTooGeneric(t))
    .slice(0, Math.max(LIMIT * 2, 20));

  console.log("Trends gevonden:", trends.length);

  // If no-openai dry-run: just show trends and exit
  if (NO_OPENAI && DRY_RUN) {
    console.log("\nDRY-RUN (no-openai): trends preview:");
    trends.slice(0, LIMIT).forEach((t, i) => console.log(`${i + 1}. ${t}`));
    return;
  }

  const newArticles = []; // only published articles end up here
  let writtenCount = 0; // pending OR published counts toward limit

  // ✅ lazy import for review (prevents editor.js OpenAI init when skipping)
  let reviewArticleFn = null;
  async function getReviewArticle() {
    if (reviewArticleFn) return reviewArticleFn;
    const mod = await import("./editor.js");
    reviewArticleFn = mod.reviewArticle;
    return reviewArticleFn;
  }

  for (const trend of trends) {
    if (writtenCount >= LIMIT) break;

    const topic_mode = weightedPick(TOPIC_MODE_WEIGHTS);

    let article_type;
    if (FORCE_INVESTIGATION) {
      article_type = "investigation";
    } else {
      article_type = weightedPick(ARTICLE_TYPE_WEIGHTS);
    }

    if (
      article_type === "investigation" &&
      !FORCE_INVESTIGATION &&
      countInvestigationsToday(allForQuota) >= MAX_INVESTIGATIONS_PER_DAY
    ) {
      article_type = weightedPick({
        normal: ARTICLE_TYPE_WEIGHTS.normal,
        short: ARTICLE_TYPE_WEIGHTS.short,
      });
    }

    console.log(`\n--- Trend: ${trend}`);
    console.log(`  topic_mode: ${topic_mode} | article_type: ${article_type}`);

    const ctx = await buildTrendContext(trend, {
      topic_mode,
      existingSources,
      newsPerTrend: NEWS_PER_TREND,
      FORCE,
      aiCtx,
    });
    if (!ctx) continue;

    const { news, actualTrend, sourceSummary } = ctx;

    // ludiek filter
    const suitability = await isLudicSuitableAI(aiCtx, {
      trend: actualTrend,
      newsTitle: news.title,
    });
    if (!suitability.suitable) {
      console.log(`  Skip (ludiek-filter): ${suitability.reason || "Niet geschikt"}`);
      continue;
    }

    // category + editor
    const category = await classifyCategoryAI(aiCtx, {
      trend: actualTrend,
      newsTitle: news.title,
    });
    const editor = pickEditorForCategory(category);

    // feedback rules
    const feedbackContext = buildFeedbackContext({
      rows: feedbackRows,
      category,
      editor_id: editor?.id,
      editor_name: editor?.name,
      maxGlobal: FEEDBACK_MAX_GLOBAL,
      maxCategory: FEEDBACK_MAX_CATEGORY,
      maxEditor: FEEDBACK_MAX_EDITOR,
    });

    console.log(`  Context: ${news.title}`);
    console.log(`  Category: ${category}`);
    console.log(`  Editor: ${editor.name} (${editor.role})`);
    if (feedbackContext?.trim()) console.log("  Feedback-rules: ON");

    // --- 1) draft ---
    let draft;
    try {
      draft = await generateArticle(aiCtx, {
        trend: actualTrend,
        newsTitle: news.title,
        newsLink: news.link,
        sourceSummary,
        category,
        editor,
        article_type,
        topic_mode,
        feedbackContext,
      });
    } catch (e) {
      console.log(`  Generatie faalde. Skip. (${String(e?.message || e)})`);
      continue;
    }

    if (draft?.skip) {
      console.log(`  Skip (generator): ${cleanText(draft.reason || "Niet geschikt")}`);
      continue;
    }

    const draftTitle0 = cleanText(draft.title || fallbackTitle(actualTrend));
    const draftSubtitle0 = cleanText(draft.subtitle || "Het land reageert met urgentie en uitstel.");
    const draftContent0 = String(draft.content_markdown || "").trim();

    // --- 2) writers room notes ---
    const writersNotes = await writersRoomNotesAI(aiCtx, {
      title: draftTitle0,
      subtitle: draftSubtitle0,
      content: draftContent0,
      article_type,
      topic_mode,
    });

    // --- 3) punch-up rewrite ---
    const punched = await punchUpRewriteAI(aiCtx, {
      trend: actualTrend,
      newsTitle: news.title,
      newsLink: news.link,
      sourceSummary,
      category,
      editor,
      article_type,
      topic_mode,
      feedbackContext,
      draftTitle: draftTitle0,
      draftSubtitle: draftSubtitle0,
      draftContent: draftContent0,
      writersNotes,
    });

    // --- 4) final editor pass ---
    const finalDraft = await finalEditorPassAI(aiCtx, {
      editor,
      title: punched.title,
      subtitle: punched.subtitle,
      content: punched.content_markdown,
      article_type,
    });

    // title/slug
    const title = cleanText(finalDraft.title || fallbackTitle(actualTrend));
    const subtitle = cleanText(finalDraft.subtitle || "Het land reageert met urgentie en uitstel.");
    const slug = slugify(title);

    if (!slug) {
      console.log("  Slug ongeldig. Skip.");
      continue;
    }
    if (!FORCE && existingSlugs.has(slug)) {
      console.log(`  Slug bestaat al (${slug}). Skip.`);
      continue;
    }

    // normalize + remove signature
    const content = finalizeContent(finalDraft.content_markdown, article_type);

    // actualiteit-check (alleen bij trending)
    if (topic_mode === "trending") {
      const actuality = await runActualityChecksOrExplain(aiCtx, {
        title,
        subtitle,
        content,
        NEWS_RSS,
      });

      if (!actuality.ok) {
        console.log(
          `  Queue (actualiteit): ${actuality.reason} | claim: "${actuality.failed_claim}"`
        );

        if (!DRY_RUN && HUMAN_REVIEW_MODE) {
          queuePending({
            PENDING_PATH,
            title,
            subtitle,
            slug,
            category,
            content,
            editor,
            news,
            topic_mode,
            article_type,
            notes: [
              `Actualiteit-check faalde: ${actuality.reason}`,
              `Claim: ${actuality.failed_claim}`,
              actuality.rewrite_instructions ? `Rewrite-advies: ${actuality.rewrite_instructions}` : "",
              actuality.sample_headline ? `Voorbeeldkop: ${actuality.sample_headline}` : "",
            ].filter(Boolean),
          });

          await notifyReviewNeeded({ title, score: 0, reason: "Actualiteit-check" });
        }

        writtenCount++;
        if (writtenCount >= LIMIT) break;
        continue;
      }
    }

    // person filter
    const people = await extractPersonNamesAI(aiCtx, {
      newsTitle: news.title,
      articleTitle: title,
      articleSubtitle: subtitle,
      articleContent: content,
    });

    const seriousHit = await hasSeriousRecentNewsAboutPeople({ people, NEWS_RSS });
    if (seriousHit.hit) {
      console.log(`  Skip (persoon-filter): ${seriousHit.reason}`);
      continue;
    }

    // featured candidate (nu: alle editors kunnen candidate zijn)
    const isShortNews = article_type === "short";
    const featuredCandidate =
      FEATURED_CATEGORIES.includes(category);

    // article object
    const article = makeArticle({
      title,
      subtitle,
      slug,
      category,
      content,
      topic_mode,
      article_type,
      editor,
      news,
      featuredCandidate,
    });

    // images (best effort)
    if (IMAGE_MODE !== "off") {
      const img = await getArticleImage(
        {
          title,
          trend: actualTrend,
          category,
          sourceHeadline: article.source_headline || "",
          slug,
        },
        { mode: IMAGE_MODE, widths: IMAGE_WIDTHS }
      ).catch(() => null);

      if (img?.urls?.original) {
        attachImage(article, img);
        console.log(`  Image: ${img.provider} | query="${img.query}"`);
      } else {
        console.log("  Image: niets gevonden");
      }
    }

    // AI-eindredacteur (quality gate)
    let review;
    if (SKIP_REVIEW) {
      review = { approved: true, score: 100, reasons: [], article_id: article.id };
    } else {
      const reviewArticle = await getReviewArticle();
      review = await reviewArticle({ ...article, body: article.content });
    }

    article.review_status = review.approved ? "approved" : "rejected";
    article.review_score = review.score;
    article.review_notes = review.reasons || [];
    article.review_id = review.article_id;

    const needsHuman = FORCE_ALL_TO_PENDING
      ? true
      : (HUMAN_REVIEW_MODE && (!review.approved || review.score < HUMAN_REVIEW_SCORE_BELOW));

    if (needsHuman) {
      console.log(`  -> Naar wachtrij (needs_human): score ${review.score} | ${article.title}`);

      if (!DRY_RUN) {
        const pending = readJson(PENDING_PATH, []);
        article.review_status = "needs_human";
        pending.unshift(article);
        writeJsonFile(PENDING_PATH, pending);

        await notifyReviewNeeded({ title: article.title, score: review.score, reason: "Pending review" });
      }

      writtenCount++;
      if (writtenCount >= LIMIT) break;
      continue;
    }

    console.log(`  ✅ AI APPROVED (score ${review.score})`);
    newArticles.push(article);
    allForQuota.unshift(article);
    existingSlugs.add(slug);

    writtenCount++;
    if (writtenCount >= LIMIT) break;
  }

  if (DRY_RUN) {
    if (writtenCount === 0) {
      console.log("\nDRY-RUN: geen nieuwe artikelen (alles skip).");
    } else {
      console.log(`\nDRY-RUN: geschreven (incl pending): ${writtenCount}/${LIMIT}`);
      if (newArticles.length) {
        console.log("\nDRY-RUN: dit zou worden gepubliceerd:");
        for (const a of newArticles) {
          console.log(`- ${a.category} | ${a.article_type}/${a.topic_mode} | ${a.title} (${a.slug})`);
          console.log(`  bron: ${a.source_url || "(societal_pulse)"}`);
        }
      } else {
        console.log("\nDRY-RUN: alles ging naar pending of werd geskipt.");
      }
    }
    return;
  }

  if (newArticles.length === 0) {
    console.log(`\nGeschreven (incl pending): ${writtenCount}/${LIMIT}`);
    console.log("Geen nieuwe artikelen gepubliceerd (alles ging naar pending/skip).");
    console.log(`Wachtrij (pending): ${PENDING_PATH}`);
    return;
  }

  let merged = [...newArticles, ...existing];
  merged = applyFeaturedRules(merged, { maxFeatured: MAX_FEATURED, ttlHours: FEATURED_TTL_HOURS });
    // --- GARANTIE: altijd minstens 1 featured ---
  if (!merged.some((a) => a.is_featured)) {
    const fallback =
      merged.find((a) => !a.is_short_news && a.article_type !== "short") ||
      merged.find((a) => FEATURED_CATEGORIES.includes(a.category)) ||
      merged[0];

    if (fallback) {
      const now = Date.now();
      fallback.is_featured = true;
      fallback.featured_at = new Date(now).toISOString();
      fallback.featured_until = new Date(
        now + FEATURED_TTL_HOURS * 3600 * 1000
      ).toISOString();
    }
  }
  writeJson(OUT_PATH, merged);

  console.log(`\nGeschreven: ${OUT_PATH}`);
  console.log(`Nieuwe artikelen gepubliceerd: ${newArticles.length}`);
  console.log(`Wachtrij (pending): ${PENDING_PATH}`);
  console.log(`Geschreven (incl pending): ${writtenCount}/${LIMIT}`);
}

// -------------------- helpers (publish-local) --------------------
function toNumber(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pickEditorForCategory(category) {
  const eligible = editors.filter((e) => (e.categories || []).includes(category));
  const pool = eligible.length ? eligible : editors;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function getNewsContext(trend, newsPerTrend) {
  try {
    const xml = await fetchText(NEWS_RSS(trend));
    const items = parseRssItems(xml).slice(0, newsPerTrend);
    if (!items.length) return null;

    const chosen = items.find((x) => x.title && x.link) || items[0];
    return { title: cleanText(chosen.title), link: cleanText(chosen.link) };
  } catch {
    return null;
  }
}

async function buildTrendContext(trend, { topic_mode, existingSources, newsPerTrend, FORCE, aiCtx }) {
  if (topic_mode === "societal_pulse") {
    const news = await generateSocietalPulseHookAI(aiCtx);
    if (!news) {
      console.log("  Geen societal pulse hook. Skip.");
      return null;
    }
    return { news, actualTrend: news.trend, sourceSummary: null };
  }

  const news = await getNewsContext(trend, newsPerTrend);
  if (!news) {
    console.log("  Geen nieuwscontext gevonden. Skip.");
    return null;
  }

  if (!FORCE && news.link && existingSources.has(news.link)) {
    console.log("  Bestaat al (source_url match). Skip.");
    return null;
  }

  let sourceSummary = null;
  try {
    const html = await fetchText(news.link);
    const readable = extractReadableTextFromHtml(html);
    sourceSummary = await summarizeSourceArticleAI(aiCtx, {
      headline: news.title,
      articleText: readable,
    });
    if (Array.isArray(sourceSummary) && sourceSummary.length) {
      console.log(`  Bron-samenvatting: ${sourceSummary.length} bullets`);
    }
  } catch {
    sourceSummary = null;
  }

  return { news, actualTrend: trend, sourceSummary };
}

function finalizeContent(content_markdown, article_type) {
  if (!content_markdown) return "";

  let text = removeAuthorSignature(String(content_markdown));

  if (article_type === "investigation") {
    text = normalizeInvestigationMarkdown(text);
    text = text.replace(/^#{3,}\s+/gm, "## ");
    return text.trim();
  }

  return normalizeParagraphs(text, { minSentences: 2, maxSentences: 4 }).trim();
}

function makeArticle({
  title,
  subtitle,
  slug,
  category,
  content,
  topic_mode,
  article_type,
  editor,
  news,
  featuredCandidate,
}) {
  return {
    id: crypto.randomUUID(),
    slug,
    title,
    subtitle,
    category,
    content,

    topic_mode,
    article_type,

    image: null,
    image_url: null,
    thumbnail_url: null,
    image_source: null,
    image_license: null,

    is_featured: false,
    is_short_news: article_type === "short",
    featured_at: null,
    featured_until: null,
    featured_candidate: featuredCandidate,

    author: editor.name,
    created_date: new Date().toISOString(),

    source_url: news.link,
    source_headline: news.title,

    editor_id: editor.id,
    editor_name: editor.name,
    editor_role: editor.role,
  };
}

function attachImage(article, img) {
  article.image = img;
  article.image_url = img.urls.large || img.urls.original;
  article.thumbnail_url = img.urls.thumb || img.urls.small || img.urls.original;
  article.image_source = img.source_page_url || null;
  article.image_license = img.license?.short || null;
}

function queuePending({
  PENDING_PATH,
  title,
  subtitle,
  slug,
  category,
  content,
  editor,
  news,
  topic_mode,
  article_type,
  notes,
}) {
  const pending = readJson(PENDING_PATH, []);
  pending.unshift({
    id: crypto.randomUUID(),
    slug,
    title,
    subtitle,
    category,
    content,

    topic_mode: topic_mode || "trending",
    article_type: article_type || "normal",

    image: null,
    image_url: null,
    thumbnail_url: null,
    image_source: null,
    image_license: null,

    is_featured: false,
    is_short_news: article_type === "short",
    featured_at: null,
    featured_until: null,
    featured_candidate: false,

    author: editor?.name || "Redactie",
    created_date: new Date().toISOString(),

    source_url: news?.link || null,
    source_headline: news?.title || null,

    editor_id: editor?.id || null,
    editor_name: editor?.name || null,
    editor_role: editor?.role || null,

    review_status: "needs_human",
    review_score: 0,
    review_notes: notes || [],
  });
  writeJsonFile(PENDING_PATH, pending);
}

async function notifyReviewNeeded({ title, score, reason }) {
  if (!REVIEW_WEBHOOK_URL) return;

  const msgParts = [
    "📝 Nieuw item voor review:",
    title ? `"${title}"` : "(zonder titel)",
    typeof score === "number" ? `(score ${score})` : "",
    reason ? `— ${reason}` : "",
    REVIEW_DASHBOARD_URL ? `→ ${REVIEW_DASHBOARD_URL}` : "",
  ].filter(Boolean);

  const text = msgParts.join(" ");
  const payload = { text };

  await fetch(REVIEW_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
}
