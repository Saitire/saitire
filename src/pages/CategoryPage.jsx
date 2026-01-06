import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Header from "../components/Header";
import Footer from "../components/Footer";
import RightRail from "../components/RightRail";
import { fetchArticles, sortByDateDesc, filterByCategory } from "../api/articles";
import { categoryLabel, categoryClasses, CATEGORIES } from "../utils/slug";
import { getImage } from "../utils/images";

function isValidCategory(key) {
  return CATEGORIES.some((c) => c.key === key);
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CategoryPage() {
  const { category } = useParams();

  const { data: articles = [], isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => sortByDateDesc(await fetchArticles()),
  });

  const items = useMemo(() => {
    if (!category) return [];
    return filterByCategory(articles, category).filter((a) => !a.is_short_news);
  }, [articles, category]);

  if (!category || !isValidCategory(category)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-black text-slate-900">Categorie niet gevonden</h1>
          <p className="mt-2 text-slate-600">
            Deze categorie bestaat niet. Kies er eentje uit het menu.
          </p>
          <Link to="/" className="inline-block mt-6 font-bold text-[#f26522]">
            Terug naar home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <span className={`px-3 py-1 text-sm font-bold rounded-full ring-1 ${categoryClasses(category)}`}>
            {categoryLabel(category)}
          </span>
          <h1 className="text-3xl font-black text-slate-900">{categoryLabel(category)}</h1>
        </div>

        {isLoading && <div className="text-slate-600">Laden…</div>}
        {error && <div className="text-red-600">Fout: {String(error)}</div>}

        {!isLoading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-8">
              {items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-slate-600">
                  Nog geen artikelen in deze categorie.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((a) => {
                    const thumb = getImage(a, "small") || getImage(a, "thumb");
                    return (
                      <Link
                        key={a.slug}
                        to={`/artikel/${a.slug}`}
                        className="group bg-white rounded-2xl border border-slate-100 hover:shadow-md transition overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex items-start gap-4">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                loading="lazy"
                                className="h-14 w-14 rounded-2xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-2xl border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#f26522]" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${categoryClasses(a.category)}`}>
                                  {categoryLabel(a.category)}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {a.created_date ? formatDate(a.created_date) : ""}
                                </span>
                              </div>

                              <div className="text-lg font-black text-slate-900 group-hover:underline decoration-[#f26522] decoration-2 underline-offset-4">
                                {a.title}
                              </div>

                              {a.subtitle && (
                                <div className="mt-2 text-slate-600 line-clamp-3">
                                  {a.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        <div className="px-6 py-3 text-xs text-slate-500 flex items-center justify-between">
                          <span>{a.author ? `Door ${a.author}` : ""}</span>
                          <span className="font-semibold text-slate-700">Lees →</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="lg:col-span-4">
              <RightRail
                articles={articles}
                sticky
                isShort={(x) => x?.article_type === "short" || x?.is_short_news === true}
                mostReadMode="score"
              />
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
