import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import RightRail from "../components/RightRail";
import { useQuery } from "@tanstack/react-query";
import { fetchArticles, sortByDateDesc } from "../api/articles";

export default function ExplainerPage() {
  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => sortByDateDesc(await fetchArticles()),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main */}
          <section className="lg:col-span-8">
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <img
                src="/static/explainer/explainer.png"
                alt="SAITIRE website uitleg"
                className="w-full rounded-xl border border-slate-200"
              />

              <p className="mt-6 text-slate-600 leading-relaxed">
                SAITIRE is een volledig geautomatiseerde satirische nieuwswebsite.
                Trends, nieuws en maatschappelijke signalen worden continu geanalyseerd,
                verwerkt en herschreven tot satirische artikelen — met vaste kwaliteits-
                en realiteitschecks.
              </p>

              <p className="mt-4 text-slate-600 leading-relaxed">
                Deze pagina laat visueel zien hoe het publicatieproces werkt: van trend
                tot artikel, van controle tot publicatie of menselijke review.
              </p>
            </div>
          </section>

          {/* Right rail */}
          <section className="lg:col-span-4">
            <RightRail
              articles={articles}
              sticky
              isShort={(x) => x?.article_type === "short" || x?.is_short_news}
              mostReadMode="score"
            />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
