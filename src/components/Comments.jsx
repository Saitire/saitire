// src/components/Comments.jsx
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchComments, postComment } from "../api/comments";

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
}

function buildThread(comments) {
  const byId = new Map();
  const children = new Map();

  for (const c of comments) {
    byId.set(c.id, c);
    const pid = c.parent_id || null;
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(c);
  }

  // sort: newest first within each group (list is already newest first overall, but keep deterministic)
  for (const [k, arr] of children.entries()) {
    arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    children.set(k, arr);
  }

  return { byId, children };
}

function CommentCard({ c, depth, slug, onReply }) {
  const pad = depth * 16; // px
  return (
    <div style={{ marginLeft: pad }} className="bg-white rounded-3xl border border-slate-100 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-black text-slate-900">{c.name || "Anoniem"}</div>
        <div className="text-xs text-slate-500">{formatDate(c.created_at)}</div>
      </div>

      <div className="mt-3 text-slate-800 whitespace-pre-wrap">{c.text}</div>

      {depth < 3 && (
        <button
          type="button"
          onClick={() => onReply(c.id)}
          className="mt-3 text-sm font-bold text-[#f26522] hover:underline"
        >
          Reageer
        </button>
      )}
    </div>
  );
}

export default function Comments({ slug }) {
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);

  // top-level form
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  // reply form state
  const [replyTo, setReplyTo] = useState(null); // comment id
  const [replyName, setReplyName] = useState("");
  const [replyText, setReplyText] = useState("");

  const { data: comments = [], isLoading, error } = useQuery({
    queryKey: ["comments", slug],
    queryFn: () => fetchComments(slug),
    enabled: !!slug,
  });

  const thread = useMemo(() => buildThread(comments), [comments]);

  const canSubmit = useMemo(() => {
    const t = String(text || "").trim();
    return slug && t.length >= 3 && t.length <= 1200;
  }, [slug, text]);

  const canReply = useMemo(() => {
    const t = String(replyText || "").trim();
    return slug && replyTo && t.length >= 3 && t.length <= 1200;
  }, [slug, replyTo, replyText]);

  const postTop = useMutation({
    mutationFn: () => postComment({ slug, name: name.trim() || "Anoniem", text, parent_id: null }),
    onSuccess: () => {
      setText("");
      setIsOpen(true);
      qc.invalidateQueries({ queryKey: ["comments", slug] });
    },
  });

  const postReply = useMutation({
    mutationFn: () =>
      postComment({
        slug,
        name: replyName.trim() || "Anoniem",
        text: replyText,
        parent_id: replyTo,
      }),
    onSuccess: () => {
      setReplyText("");
      setReplyTo(null);
      setIsOpen(true);
      qc.invalidateQueries({ queryKey: ["comments", slug] });
    },
  });

  const countLabel = isLoading ? "…" : String(comments.length);

  function openReply(commentId) {
    setIsOpen(true);
    setReplyTo(commentId);
    setReplyText("");
  }

  function renderNode(c, depth) {
    const kids = thread.children.get(c.id) || [];
    return (
      <div key={c.id} className="space-y-3">
        <CommentCard c={c} depth={depth} slug={slug} onReply={openReply} />

        {/* Reply form directly under the comment it targets */}
        {replyTo === c.id && (
          <div style={{ marginLeft: depth * 16 + 16 }} className="bg-white rounded-3xl border border-slate-100 p-5">
            <div className="text-sm font-black text-slate-900 mb-3">Reageren</div>

            <div className="grid gap-3">
              <input
                value={replyName}
                onChange={(e) => setReplyName(e.target.value)}
                placeholder="Naam (optioneel)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                maxLength={40}
              />

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Schrijf een reactie…"
                className="w-full min-h-[100px] rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                maxLength={1200}
              />

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {String(replyText || "").trim().length}/1200
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 hover:bg-slate-50"
                  >
                    Annuleer
                  </button>

                  <button
                    type="button"
                    disabled={!canReply || postReply.isPending}
                    onClick={() => postReply.mutate()}
                    className="rounded-2xl bg-slate-900 text-white font-black px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Plaats reactie
                  </button>
                </div>
              </div>

              {postReply.error && (
                <div className="text-sm text-red-600">
                  Fout: {String(postReply.error.message || postReply.error)}
                </div>
              )}
            </div>
          </div>
        )}

        {kids.length > 0 && (
          <div className="space-y-3">
            {kids.map((k) => renderNode(k, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const topLevel = thread.children.get(null) || [];

  return (
    <section className="mt-8">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 bg-white rounded-3xl border border-slate-100 px-5 py-4 shadow-sm hover:shadow transition"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="text-lg font-black text-slate-900">Reacties</div>
          <div className="text-xs font-bold text-slate-600 bg-slate-100 rounded-full px-3 py-1">
            {countLabel}
          </div>
        </div>

        <div
          className={`text-slate-500 text-2xl leading-none transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </div>
      </button>

      {isOpen && (
        <div className="mt-3">
          {/* top-level form */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
            <div className="text-sm font-black text-slate-900 mb-3">Plaats een reactie</div>

            <div className="grid gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Naam (optioneel)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                maxLength={40}
              />

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Schrijf een reactie…"
                className="w-full min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                maxLength={1200}
              />

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">{String(text || "").trim().length}/1200</div>

                <button
                  type="button"
                  disabled={!canSubmit || postTop.isPending}
                  onClick={() => postTop.mutate()}
                  className="rounded-2xl bg-slate-900 text-white font-black px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Plaats reactie
                </button>
              </div>

              {postTop.error && (
                <div className="text-sm text-red-600">
                  Fout: {String(postTop.error.message || postTop.error)}
                </div>
              )}
            </div>
          </div>

          {/* list */}
          <div className="mt-4">
            {isLoading && <div className="text-slate-600">Reacties laden…</div>}
            {error && <div className="text-red-600">Fout: {String(error)}</div>}

            {!isLoading && !error && comments.length === 0 && (
              <div className="text-slate-600">Nog geen reacties. Jij mag aftrappen.</div>
            )}

            {!isLoading && !error && comments.length > 0 && (
              <div className="space-y-3">
                {topLevel.map((c) => renderNode(c, 0))}
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            In de toekomst: reacties alleen na aanmelden.
          </div>
        </div>
      )}
    </section>
  );
}
