// src/pages/Admin.jsx
import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_ADMIN_API_BASE || "http://localhost:5179";

function getToken() {
  return localStorage.getItem("admin_token") || "";
}
function setToken(t) {
  localStorage.setItem("admin_token", t);
}
function clearToken() {
  localStorage.removeItem("admin_token");
}

function pickImageUrl(a) {
  return (
    a?.image_url ||
    a?.thumbnail_url ||
    a?.image?.urls?.medium ||
    a?.image?.urls?.large ||
    a?.image?.urls?.original ||
    null
  );
}

async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export default function Admin() {
  const [token, setTok] = useState(getToken());
  const [password, setPassword] = useState("");

  const [view, setView] = useState("pending"); // "pending" | "published" | "feedback"
  const [pending, setPending] = useState([]);
  const [published, setPublished] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);

  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(""); // reject feedback for pending articles
  const [msg, setMsg] = useState("");

  const pendingSorted = useMemo(() => pending, [pending]);
  const publishedSorted = useMemo(() => published, [published]);

  const feedbackSorted = useMemo(() => {
    // newest first if created_at exists
    return [...(feedbackItems || [])].sort((a, b) => {
      const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
  }, [feedbackItems]);

  async function refreshPending() {
    const data = await api("/api/pending");
    setPending(data.pending || []);
  }

  async function refreshPublished() {
    const data = await api("/api/published");
    setPublished(data.published || []);
  }

  async function refreshFeedback() {
    const data = await api("/api/feedback");
    setFeedbackItems(data.feedback || []);
  }

  async function refreshAll() {
    await Promise.all([refreshPending(), refreshPublished(), refreshFeedback()]);
  }

  useEffect(() => {
    if (!token) return;
    refreshAll().catch((e) => setMsg(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function doLogin(e) {
    e.preventDefault();
    setMsg("");
    const data = await api("/api/login", { method: "POST", body: { password } });
    setToken(data.token);
    setTok(data.token);
    setPassword("");
  }

  async function approve() {
    if (!selected) return;
    setMsg("");
    await api("/api/approve", {
      method: "POST",
      body: { id: selected.id, slug: selected.slug },
    });

    setSelected(null);
    setFeedback("");
    await refreshAll();
    setMsg("Goedgekeurd en gepubliceerd.");
  }

  async function reject() {
    if (!selected) return;
    setMsg("");
    await api("/api/reject", {
      method: "POST",
      body: { id: selected.id, slug: selected.slug, feedback },
    });

    setSelected(null);
    setFeedback("");
    await refreshAll();
    setMsg("Afgekeurd; feedback opgeslagen.");
  }

  async function deletePublished(item) {
    if (!item) return;
    const ok = window.confirm(`Verwijderen? "${item.title}"`);
    if (!ok) return;

    setMsg("");
    await api("/api/delete_published", {
      method: "POST",
      body: { id: item.id, slug: item.slug },
    });

    if (selected?.id === item.id) setSelected(null);

    await refreshPublished();
    setMsg("Artikel verwijderd.");
  }

  async function deleteFeedbackItem(item) {
    if (!item) return;
    const ok = window.confirm("Feedback verwijderen?");
    if (!ok) return;

    setMsg("");
    await api("/api/feedback_delete", {
      method: "POST",
      body: { id: item.id },
    });

    if (selected?.id === item.id) setSelected(null);
    await refreshFeedback();
    setMsg("Feedback verwijderd.");
  }

  async function resolveFeedbackItem(item, resolved = true) {
    if (!item) return;
    setMsg("");
    await api("/api/feedback_resolve", {
      method: "POST",
      body: { id: item.id, resolved },
    });

    await refreshFeedback();
    setMsg(resolved ? "Feedback gemarkeerd als afgehandeld." : "Feedback weer opengezet.");
  }

  function formatDate(d) {
    if (!d) return "";
    try {
      return new Date(d).toLocaleString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6">
          <h1 className="text-2xl font-black text-slate-900">Admin login</h1>
          <p className="text-slate-600 mt-2">Log in om artikelen te reviewen.</p>

          <form onSubmit={doLogin} className="mt-6 space-y-3">
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full rounded-xl bg-slate-900 text-white font-black py-3">
              Inloggen
            </button>
          </form>

          {msg && <div className="mt-4 text-sm text-red-600">{msg}</div>}
          <div className="mt-6 text-xs text-slate-500">
            API: {API_BASE} (stel VITE_ADMIN_API_BASE in als dit anders is)
          </div>
        </div>
      </div>
    );
  }

  const list =
    view === "pending"
      ? pendingSorted
      : view === "published"
      ? publishedSorted
      : feedbackSorted;

  const listCount =
    view === "pending"
      ? pendingSorted.length
      : view === "published"
      ? publishedSorted.length
      : feedbackSorted.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Admin</h1>
            <p className="text-slate-600">
              Review de wachtrij, beheer geplaatste artikelen en verwerk feedback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshAll().catch((e) => setMsg(String(e.message || e)))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                clearToken();
                setTok("");
              }}
              className="rounded-xl bg-slate-900 text-white px-4 py-2 font-bold"
            >
              Uitloggen
            </button>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => {
              setView("pending");
              setSelected(null);
              setFeedback("");
              setMsg("");
            }}
            className={`px-4 py-2 rounded-lg font-bold ${
              view === "pending" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Wachtrij
          </button>
          <button
            onClick={() => {
              setView("published");
              setSelected(null);
              setFeedback("");
              setMsg("");
            }}
            className={`px-4 py-2 rounded-lg font-bold ${
              view === "published" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Geplaatst
          </button>
          <button
            onClick={() => {
              setView("feedback");
              setSelected(null);
              setFeedback("");
              setMsg("");
            }}
            className={`px-4 py-2 rounded-lg font-bold ${
              view === "feedback" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Feedback
          </button>
        </div>

        {msg && <div className="mt-4 text-sm text-slate-700">{msg}</div>}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left list */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="font-black text-slate-900">
                {view === "pending" ? "Wachtrij" : view === "published" ? "Geplaatst" : "Feedback"}
              </div>
              <div className="text-sm text-slate-600">{listCount} items</div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              {view === "pending" && (
                <>
                  {pendingSorted.map((a) => (
                    <button
                      key={a.id || a.slug}
                      onClick={() => {
                        setSelected(a);
                        setFeedback("");
                        setMsg("");
                      }}
                      className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ${
                        selected?.id === a.id ? "bg-orange-50" : ""
                      }`}
                    >
                      <div className="text-xs text-slate-500">
                        {a.category} • score {a.review_score ?? "?"}
                      </div>
                      <div className="font-black text-slate-900 line-clamp-2">{a.title}</div>
                      <div className="text-sm text-slate-600 line-clamp-2">{a.subtitle}</div>
                    </button>
                  ))}
                  {pendingSorted.length === 0 && (
                    <div className="p-4 text-slate-600">Geen items in wachtrij.</div>
                  )}
                </>
              )}

              {view === "published" && (
                <>
                  {publishedSorted.map((a) => (
                    <div
                      key={a.id || a.slug}
                      className={`w-full text-left p-4 border-b border-slate-100 ${
                        selected?.id === a.id ? "bg-orange-50" : ""
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelected(a);
                          setFeedback("");
                          setMsg("");
                        }}
                        className="w-full text-left"
                      >
                        <div className="text-xs text-slate-500">
                          {a.category} • {formatDate(a.created_date)}
                        </div>
                        <div className="font-black text-slate-900 line-clamp-2">{a.title}</div>
                        <div className="text-sm text-slate-600 line-clamp-2">{a.subtitle}</div>
                      </button>

                      <button
                        onClick={() =>
                          deletePublished(a).catch((e) => setMsg(String(e.message || e)))
                        }
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white font-black py-2 hover:bg-slate-50"
                      >
                        Verwijderen
                      </button>
                    </div>
                  ))}

                  {publishedSorted.length === 0 && (
                    <div className="p-4 text-slate-600">Nog geen geplaatste artikelen.</div>
                  )}
                </>
              )}

              {view === "feedback" && (
                <>
                  {feedbackSorted.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSelected(f);
                        setFeedback("");
                        setMsg("");
                      }}
                      className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ${
                        selected?.id === f.id ? "bg-orange-50" : ""
                      }`}
                    >
                      <div className="text-xs text-slate-500">
                        {(f.resolved ? "afgehandeld" : "open")}
                        {" • "}
                        {f.type || "feedback"}
                        {f.created_at ? ` • ${formatDate(f.created_at)}` : ""}
                      </div>
                      <div className="font-black text-slate-900 line-clamp-2">
                        {f.title || "(zonder titel)"}
                      </div>
                      <div className="text-sm text-slate-600 line-clamp-2">{f.message || ""}</div>
                    </button>
                  ))}

                  {feedbackSorted.length === 0 && (
                    <div className="p-4 text-slate-600">Nog geen feedback.</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right detail */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
            {!selected ? (
              <div className="text-slate-600">Selecteer een item uit de lijst.</div>
            ) : view === "feedback" ? (
              <>
                <div className="text-xs text-slate-500">
                  {(selected.resolved ? "afgehandeld" : "open")}
                  {" • "}
                  {selected.type || "feedback"}
                  {selected.created_at ? ` • ${formatDate(selected.created_at)}` : ""}
                  {selected.email ? ` • ${selected.email}` : ""}
                </div>

                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  {selected.title || "Feedback"}
                </h2>

                {selected.url ? (
                  <div className="mt-3 text-sm">
                    <a
                      className="text-[#f26522] font-bold"
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open link
                    </a>
                  </div>
                ) : null}

                <div className="mt-6 rounded-xl border border-slate-200 p-4 whitespace-pre-wrap leading-relaxed">
                  {selected.message}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() =>
                      resolveFeedbackItem(selected, !selected.resolved).catch((e) =>
                        setMsg(String(e.message || e))
                      )
                    }
                    className="flex-1 rounded-xl bg-slate-900 text-white font-black py-3"
                  >
                    {selected.resolved ? "Zet terug naar open" : "Markeer als afgehandeld"}
                  </button>
                  <button
                    onClick={() =>
                      deleteFeedbackItem(selected).catch((e) => setMsg(String(e.message || e)))
                    }
                    className="flex-1 rounded-xl border border-slate-200 bg-white font-black py-3"
                  >
                    Verwijderen
                  </button>
                </div>

                {selected.page_url || selected.user_agent ? (
                  <div className="mt-6 text-xs text-slate-500 space-y-1">
                    {selected.page_url ? <div>Pagina: {selected.page_url}</div> : null}
                    {selected.user_agent ? <div>User-Agent: {selected.user_agent}</div> : null}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">
                      {selected.category}
                      {view === "pending" && (
                        <>
                          {" "}
                          • AI score {selected.review_score ?? "?"}
                        </>
                      )}
                      {view === "published" && (
                        <>
                          {" "}
                          • {formatDate(selected.created_date)}
                        </>
                      )}
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mt-1">{selected.title}</h2>
                    <p className="text-slate-700 mt-2">{selected.subtitle}</p>

                    {(() => {
                      const imgUrl = pickImageUrl(selected);
                      return imgUrl ? (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <img
                            src={imgUrl}
                            alt={selected.title}
                            className="w-full h-auto block"
                            loading="lazy"
                          />
                          <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-200">
                            {selected.image?.provider
                              ? `Afbeelding: ${selected.image.provider}`
                              : "Afbeelding"}
                            {selected.image_license ? ` • ${selected.image_license}` : ""}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {view === "pending" &&
                  Array.isArray(selected.review_notes) &&
                  selected.review_notes.length > 0 && (
                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <div className="font-black text-slate-900 mb-2">AI-notes</div>
                      <ul className="list-disc pl-5 text-slate-700">
                        {selected.review_notes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="mt-6 rounded-xl border border-slate-200 p-4 whitespace-pre-wrap leading-relaxed">
                  {selected.content}
                </div>

                {view === "pending" && (
                  <div className="mt-6">
                    <label className="block font-black text-slate-900">Feedback (optioneel)</label>
                    <textarea
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 min-h-[120px]"
                      placeholder="Wat moet beter? (toon, grap, actualiteit, namen, punchline...)"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                  </div>
                )}

                {view === "pending" && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => approve().catch((e) => setMsg(String(e.message || e)))}
                      className="flex-1 rounded-xl bg-[#f26522] text-white font-black py-3"
                    >
                      Accordeer & publiceer
                    </button>
                    <button
                      onClick={() => reject().catch((e) => setMsg(String(e.message || e)))}
                      className="flex-1 rounded-xl border border-slate-200 bg-white font-black py-3"
                    >
                      Afkeuren (log feedback)
                    </button>
                  </div>
                )}

                {view === "published" && selected && (
                  <div className="mt-4">
                    <button
                      onClick={() =>
                        deletePublished(selected).catch((e) => setMsg(String(e.message || e)))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white font-black py-3 hover:bg-slate-50"
                    >
                      Verwijderen
                    </button>
                  </div>
                )}

                {selected.source_headline && (
                  <div className="mt-6 text-xs text-slate-500">
                    Bronkop: {selected.source_headline}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Pending: {pending.length} • Published: {published.length} • Feedback:{" "}
          {feedbackItems.length}
        </div>
      </div>
    </div>
  );
}
