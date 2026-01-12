// scripts/imageProviders.js
import "dotenv/config";
import { generateImage } from "./generateImage.js";

const IMAGE_WIDTHS_DEFAULT = { thumb: 200, small: 480, medium: 800, large: 1200 };

function cleanMetaString(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function stripQuotes(s) {
  return String(s || "").replace(/[“”„"]/g, "").trim();
}

/**
 * Bouw een korte prompt op basis van velden die je al hebt.
 * (Geen nieuwe data, geen search, geen extra calls.)
 */
function buildPrompt({ title, trend, category, sourceHeadline }) {
  const ti = stripQuotes(cleanMetaString(title));
  const tr = cleanMetaString(trend);
  const cat = cleanMetaString(category);
  const sh = stripQuotes(cleanMetaString(sourceHeadline));

  // Korte, stabiele prompt voor Turbo (werkt beter dan lange instructies)
  const lines = [
    "- Realistic photography, Contemporary, modern look, Neutral color grading, Natural lighting, No stylization or illustration",
    cat ? `category vibe: ${cat}` : "",
    ti ? `title concept: ${ti}` : "",
    tr ? `trend context: ${tr}` : "",
    sh ? `source headline context: ${sh}` : "",
  ].filter(Boolean);

  return lines.join(". ");
}

/**
 * Genereer 1 image via Replicate SDXL Turbo (via scripts/generateImage.js),
 * maar geef het terug in dezelfde shape als vroeger.
 */
async function generateImageReplicate({ title, trend, category, sourceHeadline, slug }) {
  const prompt = buildPrompt({ title, trend, category, sourceHeadline });

  const res = await generateImage({
    slug,
    title: cleanMetaString(title),
    summary: cleanMetaString(sourceHeadline || trend || ""),
    category: cleanMetaString(category),
    force: false,
    steps: 4,
  });

  // res: { url, cached, prompt } (uit generateImage.js)
  const url = res?.url || null;
  if (!url) return null;

  // Return shape compatibel met attachImage(article, img)
  return {
    provider: "replicate/sdxl-turbo",
    query: prompt.slice(0, 200),
    file_title: cleanMetaString(title) || "AI image",
    urls: {
      original: url,
      large: url,
      medium: url,
      small: url,
      thumb: url,
    },
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
  {
    mode = "gen", // "gen" | "web" | "off" (web wordt nu behandeld als gen)
    widths = IMAGE_WIDTHS_DEFAULT, // blijft voor compat, maar niet meer gebruikt
    openverseLicenses = null,      // compat
    enable = null,                 // compat
  } = {}
) {
  if (mode === "off") return null;

  // We houden publish clean: publish mag "web" of "gen" blijven sturen,
  // maar intern doen we altijd replicate gen (geen web search meer).
  return await generateImageReplicate({ title, trend, category, sourceHeadline, slug });
}
