// src/pages/ArticlePage.jsx
import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Header from "../components/Header";
import Footer from "../components/Footer";
import RightRail from "../components/RightRail";
import { fetchArticles, sortByDateDesc } from "../api/articles";
import Comments from "../components/Comments";
import { getImage } from "../utils/images";
import ShareBar from "../components/ShareBar";

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ArticlePage() {
  const { slug } = useParams();

  const { data: articles = [], isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => sortByDateDesc(await fetchArticles()),
  });

  const article = useMemo(
    () => articles.find((a) => a.slug === slug),
    [articles, slug]
  );

  const similar = useMemo(() => {
    if (!article) return [];

    const sameCat = articles
      .filter((a) => a.slug !== article.slug)
      .filter((a) => a.category === article.category)
      .slice(0, 6);

    if (sameCat.length >= 4) return sameCat.slice(0, 4);

    const filler = articles
      .filter((a) => a.slug !== article.slug)
      .filter((a) => a.category !== article.category)
      .slice(0, 4 - sameCat.length);

    return [...sameCat, ...filler];
  }, [articles, article]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-10 text-slate-600">Laden…</main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-10 text-red-600">
          Fout: {String(error)}
        </main>
        <Footer />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="text-slate-900 font-black text-xl">Artikel niet gevonden</div>
            <div className="text-slate-600 mt-2">Deze pagina bestaat niet (meer).</div>
            <Link className="inline-block mt-4 text-[#f26522] font-bold" to="/">
              Terug naar home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const formattedDate = formatDateTime(article.created_date);
  const canonicalUrl = `${window.location.origin}/artikel/${article.slug}`;
  const heroImg = getImage(article, "large") || getImage(article, "medium");

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link className="text-[#f26522] font-bold" to="/">
            ← Terug
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* MAIN */}
          <section className="lg:col-span-8">
            <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* HERO */}
              {heroImg ? (
                <div className="relative">
                  <div className="aspect-[16/7] bg-slate-100">
                    <img
                      src={heroImg}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* subtiele overlay voor leesbaarheid als je ooit tekst erop wilt */}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/0 to-white/0" />

                  {/* image credit */}
                  {(article?.image?.source_page_url || article?.image_source) && (
                    <div className="absolute bottom-3 right-3">
                      <a
                        href={article?.image?.source_page_url || article?.image_source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] px-3 py-1 rounded-full bg-white/85 backdrop-blur border border-slate-200 text-slate-700 hover:bg-white transition"
                        title={article?.image?.attribution_text || ""}
                      >
                        Beeldbron{article?.image?.license?.short ? ` • ${article.image.license.short}` : article?.image_license ? ` • ${article.image_license}` : ""}
                      </a>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="p-6 md:p-8">
                <div className="text-xs text-slate-500 mb-3">
                  {article.category}
                  {formattedDate ? ` • ${formattedDate}` : ""}
                  {article.author ? ` • ${article.author}` : ""}
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
                  {article.title}
                </h1>

                {article.subtitle && (
                  <p className="mt-3 text-slate-700 text-lg leading-relaxed">
                    {article.subtitle}
                  </p>
                )}
                <ShareBar title={article.title} subtitle={article.subtitle} url={canonicalUrl} />

                <div className="mt-8 text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {article.content}
                </div>

                {article.source_url && (
                  <div className="mt-8 pt-6 border-t border-slate-200 text-sm text-slate-500">
                    Bron:{" "}
                    <a
                      className="text-[#f26522] font-bold"
                      href={article.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {article.source_headline || "Link"}
                    </a>
                  </div>
                )}

                {/* extra: expliciete beeld-attributie onderaan (optioneel) */}
                {article?.image?.attribution_text && (
                  <div className="mt-3 text-xs text-slate-500">
                    {article.image.attribution_text}
                  </div>
                )}
              </div>
            </article>

            {/* comments direct onder artikel */}
            <Comments slug={slug} />

            {/* vergelijkbare artikelen onder comments */}
            <div className="mt-6 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
              <div className="text-sm font-black text-slate-900 mb-3">
                Vergelijkbare artikelen
              </div>

              {similar.length === 0 ? (
                <div className="text-sm text-slate-600">Nog even geen suggesties.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {similar.map((a) => {
                    const thumb = getImage(a, "small") || getImage(a, "thumb");
                    return (
                      <Link
                        key={a.slug}
                        to={`/artikel/${a.slug}`}
                        className="group bg-white rounded-2xl border border-slate-100 hover:shadow-sm transition overflow-hidden"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                loading="lazy"
                                className="h-12 w-12 rounded-2xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-2xl border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#f26522]" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="text-xs text-slate-500">
                                {a.category}
                                {a.created_date ? ` • ${formatDateTime(a.created_date)}` : ""}
                              </div>

                              <div className="mt-2 font-black text-slate-900 group-hover:underline decoration-[#f26522] decoration-2 underline-offset-4 line-clamp-2">
                                {a.title}
                              </div>

                              {a.subtitle && (
                                <div className="mt-2 text-sm text-slate-600 line-clamp-3">
                                  {a.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        <div className="px-4 py-3 text-xs text-slate-500 flex items-center justify-between">
                          <span>Lees verder</span>
                          <span className="font-semibold text-slate-700">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SIDEBAR */}
          <section className="lg:col-span-4">
            <RightRail
              articles={articles}
              currentSlug={slug}
              sticky
              isShort={(a) => a?.article_type === "short" || a?.is_short_news === true}
              mostReadMode="score"
            />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
