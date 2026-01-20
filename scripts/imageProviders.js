// scripts/imageProviders.js
console.log(">>> imageProviders.js LOADED <<<", import.meta.url);

import "dotenv/config";
import { generateImage } from "./generateImage.js";
import { uploadImageUrlToR2 } from "./lib/r2Upload.js";

const IMAGE_WIDTHS_DEFAULT = { thumb: 200, small: 480, medium: 800, large: 1200 };

function rid(prefix = "img") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function log(ctx, msg, extra) {
  const base = `[${new Date().toISOString()}] [${ctx}] ${msg}`;
  if (extra !== undefined) console.log(base, extra);
  else console.log(base);
}

function cleanMetaString(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function stripQuotes(s) {
  return String(s || "").replace(/[“”„"]/g, "").trim();
}

/**
 * Korte, stabiele prompt (voor logging / trace; de echte prompt zit in generateImage zelf)
 */
function buildPrompt({ title, trend, category, sourceHeadline }) {
  const ti = stripQuotes(cleanMetaString(title));
  const tr = cleanMetaString(trend);
  const cat = cleanMetaString(category);
  const sh = stripQuotes(cleanMetaString(sourceHeadline));

  const lines = [
    "- Contemporary editorial photo, neutral grading, natural light, no illustration, no cartoon, no newspaper style",
    cat ? `category vibe: ${cat}` : "",
    ti ? `title concept: ${ti}` : "",
    tr ? `trend context: ${tr}` : "",
    sh ? `source headline context: ${sh}` : "",
  ].filter(Boolean);

  return lines.join(". ");
}

/**
 * Normaliseer de URL die generateImage teruggeeft.
 *
 * Doel:
 * - /images/... => lees lokaal bestand op de runner en upload naar R2
 * - https://<PUBLIC_SITE_URL>/images/... => terugzetten naar /images/... (SPA HTML vermijden)
 * - echte http(s) url => direct gebruiken (Replicate CDN e.d.)
 * - overige relatieve paden => resolven tegen IMAGE_BASE_URL of dev server (NIET PUBLIC_SITE_URL)
 */
function normalizeGeneratedImageUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return null;

  // 1) lokaal images pad
  if (raw.startsWith("/images/")) return raw;

  // 2) als iemand ooit PUBLIC_SITE_URL ervoor plakt (gevaarlijk: geeft HTML in productie)
  const publicBase = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (publicBase && raw.startsWith(publicBase + "/images/")) {
    try {
      const u = new URL(raw);
      if (u.pathname.startsWith("/images/")) return u.pathname;
    } catch {
      // fallback: probeer het stuk na /images/ te pakken
      const idx = raw.indexOf("/images/");
      if (idx >= 0) return raw.slice(idx);
    }
  }

  // 3) echte remote url
  if (/^https?:\/\//i.test(raw)) return raw;

  // 4) ander relatief pad -> resolve tegen image base / dev server
  const base =
    (process.env.IMAGE_BASE_URL || "").trim().replace(/\/$/, "") ||
    (process.env.VITE_DEV_SERVER_URL || "").trim().replace(/\/$/, "") ||
    "http://localhost:5173";

  return new URL(raw, base + "/").toString();
}

async function generateImageReplicate({ title, trend, category, sourceHeadline, slug }) {
  const requestId = rid("img");
  const ctx = `${requestId}:${slug || "no-slug"}`;

  const prompt = buildPrompt({ title, trend, category, sourceHeadline });

  log(ctx, "start generateImageReplicate", {
    slug,
    title: cleanMetaString(title)?.slice(0, 120),
    category: cleanMetaString(category),
    trend: cleanMetaString(trend)?.slice(0, 120),
    sourceHeadline: cleanMetaString(sourceHeadline)?.slice(0, 120),
    promptPreview: prompt.slice(0, 180),
  });

  // 1) Genereren -> URL terug
  const t0 = Date.now();
  let res;
  try {
    res = await generateImage({
      slug,
      title: cleanMetaString(title),
      summary: cleanMetaString(sourceHeadline || trend || ""),
      category: cleanMetaString(category),
      force: false,
      steps: 4,
    });
    log(ctx, "generateImage OK", { ms: Date.now() - t0, resKeys: Object.keys(res || {}) });
  } catch (e) {
    log(ctx, "generateImage FAILED", {
      ms: Date.now() - t0,
      name: e?.name,
      message: e?.message,
      stack: e?.stack?.split("\n").slice(0, 6).join("\n"),
    });
    return null;
  }

  const replicateUrlRaw = String(res?.url || "").trim();
  if (!replicateUrlRaw) {
    log(ctx, "generateImage returned no url", res);
    return null;
  }

  const sourceUrl = normalizeGeneratedImageUrl(replicateUrlRaw);
  if (!sourceUrl) {
    log(ctx, "normalizeGeneratedImageUrl returned null", { replicateUrlRaw });
    return null;
  }

  // 2) Upload naar R2
  const t1 = Date.now();
  let uploaded;
  try {
    console.log("[imageProviders] calling uploadImageUrlToR2", { slug, sourceUrl });
    uploaded = await uploadImageUrlToR2({ imageUrl: sourceUrl, slug, requestId });
    log(ctx, "uploadImageUrlToR2 OK", {
      ms: Date.now() - t1,
      uploadedKeys: Object.keys(uploaded || {}),
      url: uploaded?.url,
      key: uploaded?.key,
      etag: uploaded?.etag,
      size: uploaded?.size,
      contentType: uploaded?.contentType,
    });
  } catch (e) {
    log(ctx, "uploadImageUrlToR2 FAILED", {
      ms: Date.now() - t1,
      name: e?.name,
      message: e?.message,
      stack: e?.stack?.split("\n").slice(0, 8).join("\n"),
    });
    return null;
  }

  const url = uploaded?.url || null;
  if (!url) {
    log(ctx, "NO uploaded.url -> returning null", uploaded);
    return null;
  }

  log(ctx, "done", { finalUrl: url });

  return {
    provider: "r2 (via replicate)",
    query: prompt.slice(0, 200),
    file_title: cleanMetaString(title) || "AI image",
    urls: { original: url, large: url, medium: url, small: url, thumb: url },
    source_page_url: null,
    license: { short: "AI-generated", url: null },
    author: null,
    credit: null,
    attribution_text: "AI-generated image",
  };
}

/* -------------------- PUBLIC API -------------------- */
export async function getArticleImage(
  { title, trend, category, sourceHeadline, slug },
  { mode = "gen", widths = IMAGE_WIDTHS_DEFAULT } = {}
) {
  if (mode === "off") return null;
  // widths param kept for API compatibility; currently unused because we upload 1 original
  return await generateImageReplicate({ title, trend, category, sourceHeadline, slug });
}
