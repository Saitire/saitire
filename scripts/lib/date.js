// scripts/lib/date.js
export function dateKeyAmsterdam(isoString = new Date().toISOString()) {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const da = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${da}`;
}

export function countInvestigationsToday(allArticles) {
  const todayKey = dateKeyAmsterdam();
  return (allArticles || []).filter(
    (a) => a.article_type === "investigation" && dateKeyAmsterdam(a.created_date) === todayKey
  ).length;
}
