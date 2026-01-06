// scripts/imageProviders.js
import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import OpenAI from "openai";

const IMAGE_WIDTHS_DEFAULT = { thumb: 200, small: 480, medium: 800, large: 1200 };
const OPENVERSE_LICENSES_DEFAULT = ["cc0", "pdm", "by", "by-sa"];

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}
function cleanMetaString(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function stripQuotes(s) {
  return String(s || "").replace(/[“”„"]/g, "").trim();
}
function safeSlugify(s) {
  const t = cleanMetaString(s || "artikel");
  return t
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "artikel";
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "SAItirePublisher/1.0 (+images)" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.json();
}

/* -------------------- COMMONS -------------------- */
function pickBestCommonsPage(pagesObj) {
  const pages = Object.values(pagesObj || {});
  const ok = pages.filter((p) => p?.imageinfo?.[0]?.url);
  if (!ok.length) return null;

  ok.sort((a, b) => {
    const ia = a.imageinfo?.[0] || {};
    const ib = b.imageinfo?.[0] || {};
    const sa = (ia.width || 0) * (ia.height || 0);
    const sb = (ib.width || 0) * (ib.height || 0);
    return sb - sa;
  });

  return ok[0];
}

async function searchCommonsImage(query, widths) {
  const q = cleanMetaString(query);
  if (!q || q.length < 3) return null;

  const searchUrl =
    "https://commons.wikimedia.org/w/api.php" +
    `?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=6&gsrlimit=8` +
    `&gsrwhat=text&gsrsort=relevance` +
    `&gsrsearch=${encodeURIComponent(q)}` +
    `&prop=imageinfo|info` +
    `&iiprop=url|size|extmetadata` +
    `&inprop=url` +
    `&iiurlwidth=${widths.large}`;

  const data = await fetchJson(searchUrl);
  const best = pickBestCommonsPage(data?.query?.pages);
  if (!best) return null;

  const info = best.imageinfo?.[0] || {};
  const meta = info.extmetadata || {};
  const fileTitle = best.title;
  const filePageUrl = best.fullurl || best.canonicalurl || null;

  async function fetchThumb(width) {
    const u =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&format=json&origin=*` +
      `&titles=${encodeURIComponent(fileTitle)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=${width}`;
    const j = await fetchJson(u);
    const page = pickBestCommonsPage(j?.query?.pages);
    const ii = page?.imageinfo?.[0] || {};
    return ii.thumburl || ii.url || null;
  }

  const urls = {
    original: info.url || null,
    large: await fetchThumb(widths.large),
    medium: await fetchThumb(widths.medium),
    small: await fetchThumb(widths.small),
    thumb: await fetchThumb(widths.thumb),
  };

  const licenseShort = cleanMetaString(meta.LicenseShortName?.value || "");
  const licenseUrl = cleanMetaString(meta.LicenseUrl?.value || "");
  const author = cleanMetaString(meta.Artist?.value || "");
  const credit = cleanMetaString(meta.Credit?.value || "");

  const attributionTextParts = [];
  if (author) attributionTextParts.push(`Auteur: ${author}`);
  if (licenseShort) attributionTextParts.push(`Licentie: ${licenseShort}`);

  return {
    provider: "wikimedia_commons",
    query: q,
    file_title: fileTitle,
    urls,
    source_page_url: filePageUrl,
    license: { short: licenseShort || null, url: licenseUrl || null },
    author: author || null,
    credit: credit || null,
    attribution_text: attributionTextParts.join(" • ") || null,
  };
}

/* -------------------- WIKIPEDIA THUMB -------------------- */
async function searchWikipediaThumbnail(query, widths, lang = "nl") {
  const q = cleanMetaString(query);
  if (!q || q.length < 3) return null;

  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const url =
    api +
    `?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=0&gsrlimit=5` +
    `&gsrwhat=text&gsrsort=relevance` +
    `&gsrsearch=${encodeURIComponent(q)}` +
    `&prop=pageimages|info` +
    `&piprop=thumbnail&pithumbsize=${widths.large}` +
    `&inprop=url`;

  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});
  if (!pages.length) return null;

  const withThumb = pages.filter((p) => p?.thumbnail?.source);
  if (!withThumb.length) return null;

  withThumb.sort((a, b) => (b.thumbnail?.width || 0) - (a.thumbnail?.width || 0));
  const best = withThumb[0];

  const pageUrl = best.fullurl || best.canonicalurl || null;
  const src = best.thumbnail?.source || null;
  if (!src) return null;

  const urls = { original: src, large: src, medium: src, small: src, thumb: src };

  return {
    provider: `wikipedia_${lang}`,
    query: q,
    file_title: best.title,
    urls,
    source_page_url: pageUrl,
    license: { short: "Wikipedia (zie pagina)", url: pageUrl },
    author: null,
    credit: null,
    attribution_text: `Bron: Wikipedia (${lang})`,
  };
}

/* -------------------- OPENVERSE -------------------- */
async function searchOpenverseImage(query, widths, licenses) {
  const q = cleanMetaString(query);
  if (!q || q.length < 3) return null;

  const lic = (licenses || []).join(",");
  const url =
    "https://api.openverse.engineering/v1/images/" +
    `?q=${encodeURIComponent(q)}` +
    `&page_size=10&license=${encodeURIComponent(lic)}&mature=false`;

  const data = await fetchJson(url);
  const results = data?.results || [];
  if (!results.length) return null;

  const r = results[0];

  const urls = {
    original: r.url || null,
    large: r.url || null,
    medium: r.url || null,
    small: r.thumbnail || r.url || null,
    thumb: r.thumbnail || r.url || null,
  };

  const licenseShort = cleanMetaString(r.license || "");
  const licenseUrl = cleanMetaString(r.license_url || "");
  const author = cleanMetaString(r.creator || "");
  const sourcePageUrl = cleanMetaString(r.foreign_landing_url || r.source || "");

  const attributionParts = [];
  if (author) attributionParts.push(`Auteur: ${author}`);
  if (licenseShort) attributionParts.push(`Licentie: ${licenseShort}`);

  return {
    provider: "openverse",
    query: q,
    file_title: cleanMetaString(r.title || "Openverse image"),
    urls,
    source_page_url: sourcePageUrl || null,
    license: { short: licenseShort || null, url: licenseUrl || null },
    author: author || null,
    credit: null,
    attribution_text: attributionParts.join(" • ") || "Bron: Openverse",
  };
}

/* -------------------- OPENAI GEN -------------------- */
async function generateImageOpenAI({ title, trend, category, sourceHeadline, slug }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ontbreekt voor image generation.");

  const model = process.env.IMAGE_GEN_MODEL || "gpt-image-1";
  const openai = new OpenAI({ apiKey });

  const ti = stripQuotes(cleanMetaString(title));
  const tr = cleanMetaString(trend);
  const cat = cleanMetaString(category);
  const sh = stripQuotes(cleanMetaString(sourceHeadline));
  const safeSlug = safeSlugify(slug || ti || tr);

  const prompt = `
Maak een redactionele illustratie voor een satirisch Nederlands nieuwsartikel (Speld-achtig).

Context:
- Titel: "${ti}"
- Thema/trend: "${tr}"
- Bronkop (context): "${sh}"
- Categorie: "${cat}"

Eisen:
- Editorial illustration, clean, modern, Nederlands nieuwsgevoel
- Subtiel absurd detail dat logisch past bij de titel (niet druk/cartoonachtig)
- Geen tekst, geen letters, geen logo’s, geen watermerk
- Neutrale achtergrond, geschikt als header/hero-afbeelding
- Compositie: onderwerp centraal/links met rustige ruimte voor titel-overlay
`.trim();

  console.log("  [img-gen] start", { model, safeSlug, cat, tr });

  const size = process.env.IMAGE_GEN_SIZE || "1536x1024"; // ✅ supported landscape

  const imgRes = await openai.images.generate({
    model,
    prompt,
    size, // ✅ 1024x1024 | 1024x1536 | 1536x1024 | auto
  });

  const item = imgRes?.data?.[0];
  if (!item) throw new Error("OpenAI images.generate gaf geen data[0] terug.");

  // Debug keys (laat staan; helpt enorm bij verschillen in SDK responses)
  console.log("  [img-gen] first item keys:", Object.keys(item || {}));

  // 1) b64_json → save local
  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, "base64");

    const outDir = path.join(process.cwd(), "public", "ai-images");
    await fs.mkdir(outDir, { recursive: true });

    const fileName = `${safeSlug}-${Date.now()}.png`;
    const absPath = path.join(outDir, fileName);
    await fs.writeFile(absPath, buf);

    const relUrl = `/ai-images/${fileName}`;
    console.log("  [img-gen] saved", absPath);

    return {
      provider: "openai-gen",
      query: `gen:${cat}:${tr}`.slice(0, 200),
      file_title: ti || "AI image",
      urls: { original: relUrl, large: relUrl, medium: relUrl, small: relUrl, thumb: relUrl },
      source_page_url: null,
      license: { short: "AI-generated", url: null },
      author: null,
      credit: null,
      attribution_text: "AI-generated image",
    };
  }

  // 2) url → use remote directly
  if (item.url) {
    console.log("  [img-gen] got url (no b64):", item.url);
    const u = String(item.url);
    return {
      provider: "openai-gen",
      query: `gen:${cat}:${tr}`.slice(0, 200),
      file_title: ti || "AI image",
      urls: { original: u, large: u, medium: u, small: u, thumb: u },
      source_page_url: null,
      license: { short: "AI-generated", url: null },
      author: null,
      credit: null,
      attribution_text: "AI-generated image",
    };
  }

  // 3) onverwacht format
  console.log("  [img-gen] unexpected item:", item);
  throw new Error("OpenAI images.generate gaf geen b64_json en geen url terug.");
}

/* -------------------- PUBLIC API -------------------- */
export async function getArticleImage(
  { title, trend, category, sourceHeadline, slug },
  {
    mode = "web", // "web" | "gen" | "off"
    widths = IMAGE_WIDTHS_DEFAULT,
    openverseLicenses = OPENVERSE_LICENSES_DEFAULT,
    enable = { commons: true, wikipedia: true, openverse: true },
  } = {}
) {
  if (mode === "off") return null;

  // GEN mode: altijd proberen te genereren
  if (mode === "gen") {
    return await generateImageOpenAI({ title, trend, category, sourceHeadline, slug });
  }

  // WEB mode: zoeken
  if (mode !== "web") return null;

  const t = cleanMetaString(trend);
  const sh = cleanMetaString(sourceHeadline);
  const cat = cleanMetaString(category);
  const ti = stripQuotes(cleanMetaString(title));

  const queries = uniq([
    t,
    sh,
    [t, cat].filter(Boolean).join(" "),
    [sh, cat].filter(Boolean).join(" "),
    ti,
  ]).filter((x) => x && x.length >= 3);

  if (enable.commons) {
    for (const q of queries) {
      const img = await searchCommonsImage(q, widths).catch(() => null);
      if (img?.urls?.original) return img;
    }
  }

  if (enable.wikipedia) {
    for (const q of queries) {
      const img = await searchWikipediaThumbnail(q, widths, "nl").catch(() => null);
      if (img?.urls?.original) return img;
    }
    for (const q of queries) {
      const img = await searchWikipediaThumbnail(q, widths, "en").catch(() => null);
      if (img?.urls?.original) return img;
    }
  }

  if (enable.openverse) {
    for (const q of queries) {
      const img = await searchOpenverseImage(q, widths, openverseLicenses).catch(() => null);
      if (img?.urls?.original) return img;
    }
  }

  return null;
}
