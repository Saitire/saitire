// scripts/lib/pick.js
export function weightedPick(weightMap) {
  const entries = Object.entries(weightMap).filter(([, w]) => Number(w) > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0]?.[0];
}
