export const CATEGORIES = [
  { key: 'politiek', label: 'Politiek' },
  { key: 'binnenland', label: 'Binnenland' },
  { key: 'buitenland', label: 'Buitenland' },
  { key: 'tech', label: 'Tech' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'sport', label: 'Sport' },
  { key: 'cultuur', label: 'Cultuur' },
];

export function categoryLabel(key) {
  return CATEGORIES.find(c => c.key === key)?.label || key;
}

export function categoryClasses(key) {
  const map = {
    politiek: 'bg-red-50 text-red-700 ring-red-100',
    binnenland: 'bg-blue-50 text-blue-700 ring-blue-100',
    buitenland: 'bg-purple-50 text-purple-700 ring-purple-100',
    tech: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    lifestyle: 'bg-pink-50 text-pink-700 ring-pink-100',
    sport: 'bg-orange-50 text-orange-700 ring-orange-100',
    cultuur: 'bg-yellow-50 text-yellow-800 ring-yellow-100',
  };
  return map[key] || 'bg-slate-50 text-slate-700 ring-slate-100';
}
