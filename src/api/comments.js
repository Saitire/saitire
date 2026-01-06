// src/api/comments.js
const API_BASE =
  import.meta.env.VITE_ADMIN_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:5179";

export async function fetchComments(slug) {
  const res = await fetch(`${API_BASE}/api/comments/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`fetchComments failed ${res.status}`);
  const data = await res.json();
  return data.comments || [];
}

export async function postComment({ slug, name, text, parent_id = null }) {
  const res = await fetch(`${API_BASE}/api/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, name, text, parent_id }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `postComment failed ${res.status}`);
  return data.comment;
}