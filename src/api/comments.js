// src/api/comments.js

export async function fetchComments(slug) {
  if (!slug) return [];
  const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `fetchComments failed ${res.status}`);
  return Array.isArray(data?.comments) ? data.comments : [];
}

export async function postComment({ slug, name, text, parent_id = null }) {
  const res = await fetch(`/api/comments`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ slug, name, text, parent_id }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `postComment failed ${res.status}`);

  // Comments.jsx invalidateQueries haalt daarna de lijst opnieuw op
  return data;
}
