// src/pages/RedactiePage.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Header from "../components/Header";
import Footer from "../components/Footer";
import RightRail from "../components/RightRail";
import editorsData from "../data/editors.json";

import { fetchArticles, sortByDateDesc } from "../api/articles";

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

export default function RedactiePage() {
  const navigate = useNavigate();

  // Voor RightRail: zelfde als ArticlePage
  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => sortByDateDesc(await fetchArticles()),
  });

  // Hoofdredacteur (persona)
  const chief = useMemo(
    () => ({
      id: "chief",
      name: "Marius de Graaf",
      role: "Hoofdredacteur",
      categories: [],
      signature_moves: [
        "Keurt af op één woord.",
        "Maakt de kop klinisch.",
      ],
      punchline: "Mooi geprobeerd. Nu graag waar.",
      footer_line: "Dit had strakker gekund.",
      catchphrases: ["Dit is niet ludiek.", "De drempel wordt hier niet gehaald.", "Volgende."],
      photo_url: "/static/editors/Marius de Graaf.png",
      vibe: "Procedureel, afstandelijk, moreel neutraal.",
    }),
    []
  );

  const editors = useMemo(() => [chief, ...(editorsData || [])], [chief]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <span className="text-lg leading-none">‹</span> Terug
          </button>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
                Redactie
              </h1>
              <p className="mt-2 text-slate-600">
                Vaste stemmen, signature moves en punchlines. Alles strak, tot het ontspoort.
              </p>
            </div>
          </div>
        </div>

        {/* LAYOUT: links content, rechts sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* main */}
          <section className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {editors.map((e) => {
                const cats = uniq(e.categories);
                const hero = e.photo_url;

                return (
                  <article
                    key={e.id}
                    className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition"
                  >
                    {/* image */}
                    <div className="relative">
                      {hero ? (
                        <img
                          src={hero}
                          alt={e.name}
                          loading="lazy"
                          className="h-[360px] md:h-[420px] w-full object-cover"
                          style={{ objectPosition: `50% ${e.photo_focus_y ?? 15}%` }}
                        />
                      ) : (
                        <div className="h-50 w-full bg-gradient-to-br from-orange-50 via-white to-slate-50" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/20 to-transparent" />

                      {/* category chips */}
                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        {e.id === "chief" ? (
                          <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-semibold">
                            eindredactie
                          </span>
                        ) : cats.length ? (
                          cats.slice(0, 3).map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded-full bg-white/85 backdrop-blur text-slate-800 px-3 py-1 text-xs font-semibold border border-slate-200/70"
                            >
                              {c}
                            </span>
                          ))
                        ) : null}
                      </div>

                      {/* accent dot */}
                      <div className="absolute right-4 top-4 h-10 w-10 rounded-2xl border border-white/60 bg-white/40 backdrop-blur flex items-center justify-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#f26522]" />
                      </div>
                    </div>

                    {/* content */}
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-xl font-black text-slate-900 leading-snug">
                            {e.name}
                          </h2>
                          <div className="mt-1 text-sm text-slate-600">{e.role}</div>

                          {e.vibe ? (
                            <div className="mt-3 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">Stijl:</span>{" "}
                              {e.vibe}
                            </div>
                          ) : null}
                        </div>

                        <div className="hidden sm:block">
                          <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition">
                            profiel
                          </span>
                        </div>
                      </div>

                      {/* signature moves (max 2) */}
                      {e.signature_moves?.length ? (
                        <div className="mt-5">
                          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Signature moves
                          </div>
                          <ul className="mt-3 space-y-2 text-sm text-slate-800">
                            {e.signature_moves.slice(0, 2).map((m, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1 h-2 w-2 rounded-full bg-[#f26522] shrink-0" />
                                <span className="leading-relaxed">{m}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {/* punchline (1) */}
                      {e.punchline ? (
                        <div className="mt-5">
                          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Punchline
                          </div>
                          <div className="mt-3 text-sm text-slate-800 italic">
                            “{e.punchline}”
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* sidebar */}
          <section className="lg:col-span-4">
            <RightRail
              articles={articles}
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
