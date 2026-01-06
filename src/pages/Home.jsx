// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import Header from '../components/Header';
import Footer from '../components/Footer';
import RightRail from '../components/RightRail';
import { fetchArticles, sortByDateDesc } from '../api/articles';
import { getImage } from "../utils/images";

export default function Home() {
  const { data: articles = [], isLoading, error } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => sortByDateDesc(await fetchArticles()),
  });

  const isShort = (a) => a?.article_type === 'short' || a?.is_short_news === true;

  // max 4 featured voor “slider”
  const featured = useMemo(
    () => articles.filter(a => a.is_featured).slice(0, 4),
    [articles]
  );

// main feed: alles behalve short (featured mogen óók in de lijst)
    const main = useMemo(() => {
      return articles.filter(a => !isShort(a));
    }, [articles]);

  const [idx, setIdx] = useState(0);

  // reset index als featured set verandert
  useEffect(() => {
    setIdx(0);
  }, [featured.length]);

  // autoplay (alleen als er >1 is)
  useEffect(() => {
    if (featured.length <= 1) return;
    const t = setInterval(() => {
      setIdx(i => (i + 1) % featured.length);
    }, 6000);
    return () => clearInterval(t);
  }, [featured.length]);

  const current = featured[idx];
  const dateLabel = formatDate(current?.created_date || current?.date || current?.published_at || current?.publishedAt);

  const heroImg = getImage(current, 'large');

  // debuglog
  useEffect(() => {
    if (!isLoading && !error) {
      // eslint-disable-next-line no-console
      console.log('featured:', featured.length, '| main:', main.length);
    }
  }, [isLoading, error, featured.length, main.length]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading && <div className="text-slate-600">Laden…</div>}
        {error && <div className="text-red-600">Fout: {String(error)}</div>}

        {!isLoading && !error && (
          <>
            {featured.length > 0 && (
              <section className="mb-10">
                <div className="flex items-end justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                      Uitgelicht
                    </h2>
                    <p className="text-slate-600">De redactie selecteerde deze parels voor je.</p>
                  </div>

                  {featured.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIdx(i => (i - 1 + featured.length) % featured.length)}
                        className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition"
                        aria-label="Vorige"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdx(i => (i + 1) % featured.length)}
                        className="h-10 w-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition"
                        aria-label="Volgende"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                  {/* hero image (subtiel) */}
                  {heroImg ? (
                    <>
                      <div className="absolute inset-0">
                        <img
                          src={heroImg}
                          alt=""
                          className="h-full w-full object-cover opacity-[0.12]"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/80 to-slate-50/90" />
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-slate-50" />
                      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />
                      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-slate-200/40 blur-3xl" />
                    </>
                  )}

                  <div className="relative p-6 md:p-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {current?.category && (
                            <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1">
                              {current.category}
                            </span>
                          )}
                          {dateLabel && <span className="text-slate-600">{dateLabel}</span>}
                        </div>

                        <div className="mt-4">
                          <Link to={`/artikel/${current.slug}`} className="group inline-block">
                            <h3 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight group-hover:underline decoration-[#f26522] decoration-4 underline-offset-4 transition">
                              {current.title}
                            </h3>
                          </Link>

                          {current.subtitle && (
                            <p className="mt-4 text-slate-700 text-base md:text-lg leading-relaxed">
                              {current.subtitle}
                            </p>
                          )}
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                          <Link
                            to={`/artikel/${current.slug}`}
                            className="inline-flex items-center justify-center rounded-2xl bg-[#f26522] text-white font-black px-5 py-3 hover:brightness-95 active:scale-[0.99] transition"
                          >
                            Lees dit stuk
                          </Link>

                          {current?.author && (
                            <span className="text-sm text-slate-600">
                              Door <span className="font-semibold text-slate-800">{current.author}</span>
                            </span>
                          )}
                        </div>

                        {/* bron (subtiel, alleen als aanwezig) */}
                        {current?.image?.source_page_url && (
                          <div className="mt-4 text-xs text-slate-500">
                            Beeld:{" "}
                            <a
                              href={current.image.source_page_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-slate-300 hover:decoration-slate-500"
                            >
                              {current.image.license?.short ? `Wikimedia (${current.image.license.short})` : "Wikimedia"}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="md:w-[340px] shrink-0">
                        <div className="rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur p-5">
                          <div className="text-xs text-slate-500 mb-2">Volgende up</div>
                          {featured.length > 1 ? (
                            <div>
                              <div className="text-sm font-black text-slate-900 line-clamp-3">
                                {featured[(idx + 1) % featured.length]?.title}
                              </div>
                              <button
                                type="button"
                                onClick={() => setIdx(i => (i + 1) % featured.length)}
                                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-800 hover:bg-slate-50 transition"
                              >
                                Naar volgende
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-600">
                              Eén uitgelicht artikel nu — voeg er meer toe voor rotatie.
                            </div>
                          )}

                          {featured.length > 1 && (
                            <div className="mt-5 flex gap-2">
                              {featured.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setIdx(i)}
                                  className={`h-2.5 rounded-full transition-all ${
                                    i === idx ? 'w-8 bg-slate-900' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                                  }`}
                                  aria-label={`Ga naar uitgelicht ${i + 1}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* LAYOUT: links main feed, rechts sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* main feed */}
              <section className="lg:col-span-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {main.map(a => {
                    const thumb = getImage(a, 'small');
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

                            <div className="min-w-0">
                              <div className="text-xs text-slate-500 mb-2">{a.category}</div>
                              <div className="text-lg font-black text-slate-900 group-hover:underline decoration-[#f26522] decoration-2 underline-offset-4">
                                {a.title}
                              </div>
                              {a.subtitle && <div className="text-slate-600 mt-2 line-clamp-3">{a.subtitle}</div>}
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        <div className="px-6 py-3 text-xs text-slate-500 flex items-center justify-between">
                          <span>{formatDate(a.created_date || a.date || a.published_at || a.publishedAt)}</span>
                          <span className="font-semibold text-slate-700">Lees →</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* sidebar */}
              <section className="lg:col-span-4">
                <RightRail
                  articles={articles}
                  sticky
                  isShort={isShort}
                  mostReadMode="score"
                />
              </section>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
}

