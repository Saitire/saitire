// src/pages/FeedbackPage.jsx
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import Footer from "../components/Footer";
import RightRail from "../components/RightRail";
import { fetchArticles, sortByDateDesc } from "../api/articles";

// Gebruik dezelfde origin in productie én lokaal.
// Optioneel: als je ooit een externe API host wil, zet VITE_API_BASE naar "https://...".
// Laat anders leeg.
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const FEEDBACK_ENDPOINT = `${API_BASE}/api/feedback`;

async function postFeedback(payload) {
  const res = await fetch(FEEDBACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Als er ooit HTML terugkomt (fallback), wil je niet crashen op res.json()
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: "Non-JSON response", raw: text?.slice(0, 200) };
  }

  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem("saitire_feedback_draft") || "null");
  } catch {
    return null;
  }
}

function saveDraft(draft) {
  try {
    localStorage.setItem("saitire_feedback_draft", JSON.stringify(draft));
  } catch {}
}

export default function FeedbackPage() {
  // RightRail: net als ArticlePage
  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => sortByDateDesc(await fetchArticles()),
  });

  const initial = useMemo(() => {
    const d = loadDraft();
    return {
      type: d?.type || "artikel",
      url: d?.url || "",
      title: d?.title || "",
      message: d?.message || "",
      email: d?.email || "",
    };
  }, []);

  const [type, setType] = useState(initial.type);
  const [url, setUrl] = useState(initial.url);
  const [title, setTitle] = useState(initial.title);
  const [message, setMessage] = useState(initial.message);
  const [email, setEmail] = useState(initial.email);
  const [status, setStatus] = useState(""); // success/error text
  const [busy, setBusy] = useState(false);

  function persist(next) {
    saveDraft({ type, url, title, message, email, ...next });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");
    setBusy(true);

    try {
      await postFeedback({
        type,
        url: url.trim(),
        title: title.trim(),
        message: message.trim(),
        email: email.trim(),
        page_url: window.location.href,
        created_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });

      setStatus("Ontvangen.");
      // draft leegmaken
      try {
        localStorage.removeItem("saitire_feedback_draft");
      } catch {}
      setUrl("");
      setTitle("");
      setMessage("");
      setEmail("");
      setType("artikel");
    } catch (err) {
      setStatus(`Fout: ${String(err?.message || err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
            Feedback
          </h1>
          <p className="mt-2 text-slate-600">
            Wat kan strakker aan de artikelen? Wat moet de site nog kunnen?
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* MAIN */}
          <section className="lg:col-span-8">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="p-6 md:p-8">
                <form onSubmit={onSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <div className="text-xs font-black tracking-[0.14em] text-slate-700 uppercase">
                        Type
                      </div>
                      <select
                        value={type}
                        onChange={(e) => {
                          setType(e.target.value);
                          persist({ type: e.target.value });
                        }}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                      >
                        <option value="artikel">Een artikel</option>
                        <option value="site">Website / design</option>
                        <option value="feature">Nieuwe feature</option>
                        <option value="bug">Bug</option>
                        <option value="anders">Anders</option>
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-xs font-black tracking-[0.14em] text-slate-700 uppercase">
                        E-mail (optioneel)
                      </div>
                      <input
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          persist({ email: e.target.value });
                        }}
                        type="email"
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                        placeholder="als je reactie wilt"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-xs font-black tracking-[0.14em] text-slate-700 uppercase">
                      Artikel-URL (optioneel)
                    </div>
                    <input
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        persist({ url: e.target.value });
                      }}
                      type="url"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                      placeholder="https://…"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs font-black tracking-[0.14em] text-slate-700 uppercase">
                      Korte titel (optioneel)
                    </div>
                    <input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        persist({ title: e.target.value });
                      }}
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                      placeholder="bijv. ‘kop te lang’"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs font-black tracking-[0.14em] text-slate-700 uppercase">
                      Feedback
                    </div>
                    <textarea
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        persist({ message: e.target.value });
                      }}
                      required
                      rows={7}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 resize-y"
                      placeholder="Wat viel je op? Wat moet strakker? Wat mis je?"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black disabled:opacity-60"
                    >
                      {busy ? "Versturen…" : "Verstuur feedback"}
                    </button>

                    {status ? (
                      <div className="text-sm text-slate-700">{status}</div>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* SIDEBAR */}
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
