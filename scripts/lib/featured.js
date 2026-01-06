// scripts/lib/featured.js
export function applyFeaturedRules(articles, { maxFeatured, ttlHours }) {
  const now = new Date();
  const ttlMs = ttlHours * 60 * 60 * 1000;

  // expire
  for (const a of articles) {
    if (a.is_featured && a.featured_until) {
      const until = new Date(a.featured_until);
      if (Number.isFinite(until.getTime()) && until <= now) {
        a.is_featured = false;
        a.featured_at = null;
        a.featured_until = null;
      }
    }
  }

  const sortNewestFirst = (x, y) =>
    new Date(y.created_date || 0).getTime() - new Date(x.created_date || 0).getTime();

  let pool = articles.filter((a) => a.featured_candidate);
  pool.sort(sortNewestFirst);

  if (pool.length === 0) {
    pool = articles.filter((a) => !a.is_short_news).sort(sortNewestFirst);
  }

  const chosen = pool.slice(0, maxFeatured);
  const chosenIds = new Set(chosen.map((a) => a.id));

  for (const a of articles) {
    if (chosenIds.has(a.id)) {
      a.is_featured = true;
      if (!a.featured_at) a.featured_at = now.toISOString();
      a.featured_until = new Date(now.getTime() + ttlMs).toISOString();
    } else {
      a.is_featured = false;
      a.featured_at = null;
      a.featured_until = null;
    }
    delete a.featured_candidate;
  }

  return articles;
}
