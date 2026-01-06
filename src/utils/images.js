// src/utils/images.js

/**
 * Centrale image helper: kies het juiste formaat, met fallbacks.
 * sizes: "thumb" | "small" | "medium" | "large" | "original"
 */
export function getImage(article, size = "small") {
  if (!article) return "";

  const urls = article?.image?.urls || {};
  const preferred =
    (size === "thumb" && urls.thumb) ||
    (size === "small" && (urls.small || urls.thumb)) ||
    (size === "medium" && (urls.medium || urls.small || urls.thumb)) ||
    (size === "large" && (urls.large || urls.medium || urls.small || urls.thumb)) ||
    (size === "original" && (urls.original || urls.large || urls.medium || urls.small || urls.thumb)) ||
    "";

  return (
    preferred ||
    article?.thumbnail_url ||
    article?.image_url ||
    article?.thumbnail ||
    article?.thumb ||
    article?.hero_image ||
    article?.cover_image ||
    article?.og_image ||
    ""
  );
}
