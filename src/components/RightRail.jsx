// src/components/RightRail.jsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";

function safeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function getThumb(a) {
  return (
    a?.image?.urls?.thumb ||
    a?.thumbnail_url ||
    a?.image?.urls?.small ||
    a?.image_url ||
    a?.thumbnail ||
    a?.thumb ||
    a?.image ||
    a?.hero_image ||
    a?.cover_image ||
    a?.og_image ||
    a?.image_url ||
    ""
  );
}

function Section({ title, children, right }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black tracking-[0.14em] text-slate-700 uppercase">
          {title}
        </h3>
        {right ? <div className="text-xs text-slate-500">{right}</div> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-slate-200/70" />;
}

function RailItem({ to, kicker, title, indexBadge, thumbnail }) {
  return (
    <Link
      to={to}
      className={[
        "group block px-4 py-3 transition",
        "hover:bg-slate-50/60",
        "active:bg-slate-100/60",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        {indexBadge ? (
          <div className="shrink-0 pt-0.5">
            <div className="h-6 w-6 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
              <span className="text-[11px] font-black text-slate-700">
                {indexBadge}
              </span>
            </div>
          </div>
        ) : thumbnail ? (
          <div className="shrink-0 pt-0.5">
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="h-12 w-12 rounded-2xl object-cover border border-slate-200 bg-slate-50"
            />
          </div>
        ) : (
          <div className="shrink-0 pt-1">
            <div className="h-2 w-2 rounded-full bg-[#f26522]" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {kicker ? (
            <div className="text-[11px] text-slate-500 truncate">{kicker}</div>
          ) : null}

          <div className="mt-1 text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
            {title}
          </div>

          <div className="mt-2 h-0.5 w-0 bg-[#f26522] group-hover:w-10 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export default function RightRail({
  articles = [],
  currentSlug,
  sticky = false,
  isShort = (a) => a?.article_type === "short" || a?.is_short_news === true,
  mostReadMode = "score",
  shortLimit = 10,   // blijft voor compat, maar hard max 3 wordt toegepast
  mostReadLimit = 8, // blijft voor compat, maar hard max 5 wordt toegepast
}) {
  const shortNews = useMemo(() => {
    const HARD_MAX = 3;

    return (articles || [])
      .filter((a) => !a?.is_featured && isShort(a))
      .filter((a) => (currentSlug ? a.slug !== currentSlug : true))
      .slice(0, Math.min(shortLimit, HARD_MAX));
  }, [articles, currentSlug, isShort, shortLimit]);

  const mostRead = useMemo(() => {
    const HARD_MAX = 5;

    const base = (articles || [])
      .filter((a) => !a?.is_featured) // shorts mogen ook
      .filter((a) => (currentSlug ? a.slug !== currentSlug : true));

    if (mostReadMode === "score") {
      const scored = base
        .map((a) => ({ ...a, _score: safeNumber(a.review_score, 0) }))
        .sort((x, y) => y._score - x._score);

      const out = [];
      const seen = new Set();
      for (const a of scored) {
        if (!a?.slug || seen.has(a.slug)) continue;
        seen.add(a.slug);
        out.push(a);
        if (out.length >= HARD_MAX) break;
      }
      return out;
    }

    const out = [];
    const seen = new Set();
    for (const a of base) {
      if (!a?.slug || seen.has(a.slug)) continue;
      seen.add(a.slug);
      out.push(a);
      if (out.length >= HARD_MAX) break;
    }
    return out;
  }, [articles, currentSlug, mostReadMode]);

  return (
    <aside className={sticky ? "lg:sticky lg:top-24" : ""}>
      <div className="space-y-6">
        <Section title="Kort nieuws">
          {shortNews.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">
              Nog geen korte berichtjes.
            </div>
          ) : (
            <div>
              {shortNews.map((a, idx) => (
                <React.Fragment key={a.slug}>
                  <RailItem
                    to={`/artikel/${a.slug}`}
                    kicker={a.category || ""}
                    title={a.title}
                    thumbnail={getThumb(a)}
                  />
                  {idx !== shortNews.length - 1 ? <Divider /> : null}
                </React.Fragment>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Meest gelezen"
          right={mostReadMode === "score" ? "op basis van score" : null}
        >
          {mostRead.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">
              Nog geen toppers.
            </div>
          ) : (
            <div>
              {mostRead.map((a, idx) => (
                <React.Fragment key={a.slug}>
                  <RailItem
                    to={`/artikel/${a.slug}`}
                    kicker={a.category || ""}
                    title={a.title}
                    indexBadge={idx + 1}
                  />
                  {idx !== mostRead.length - 1 ? <Divider /> : null}
                </React.Fragment>
              ))}
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
}
