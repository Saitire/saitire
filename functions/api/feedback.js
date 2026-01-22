// functions/api/feedback.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function clamp(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n) : t;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return Boolean(env.ADMIN_PASSWORD && token && token === env.ADMIN_PASSWORD);
}

async function listKeysAll(bucket, prefix) {
  const keys = [];
  let cursor = undefined;

  for (;;) {
    const res = await bucket.list({ prefix, cursor });
    for (const o of res.objects || []) keys.push(o.key);
    if (!res.truncated) break;
    cursor = res.cursor;
  }

  return keys;
}

// -------------------- GET (admin) --------------------
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401, CORS);
  if (!env.FEEDBACK_BUCKET) return json({ error: "FEEDBACK_BUCKET binding missing" }, 500, CORS);

  // user feedback + admin reject feedback
  const prefixes = ["feedback/", "reject/"];
  const keys = [];

  for (const p of prefixes) {
    const ks = await listKeysAll(env.FEEDBACK_BUCKET, p);
    keys.push(...ks);
  }

  // keys bevatten datum in pad, dus sort geeft ongeveer chronologisch; neem de laatste N
  keys.sort();
  const last = keys.slice(-400).reverse();

  const items = [];
  for (const key of last) {
    const obj = await env.FEEDBACK_BUCKET.get(key);
    if (!obj) continue;
    try {
      const v = JSON.parse(await obj.text());
      if (v && typeof v === "object") items.push(v);
    } catch {}
  }

  // newest first op created_at
  items.sort((a, b) => {
    const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  return json({ feedback: items }, 200, CORS);
}

// -------------------- POST (public) --------------------
export async function onRequestPost({ request, env }) {
  if (!env.FEEDBACK_BUCKET) {
    return json({ error: "FEEDBACK_BUCKET binding missing" }, 500, CORS);
  }

  const body = await request.json().catch(() => ({}));

  const type = clamp(body?.type || "feedback", 40);
  const title = clamp(body?.title || "", 140);
  const message = clamp(body?.message || body?.text || "", 5000);
  const url = clamp(body?.url || body?.page_url || "", 500);
  const email = clamp(body?.email || "", 120);

  if (!message) return json({ error: "Message required" }, 400, CORS);

  const id = randomId();
  const created_at = new Date().toISOString();

  const item = {
    id,
    type,
    title,
    message,
    url,
    email,
    created_at,
    resolved: false,
    user_agent: request.headers.get("user-agent") || "",
  };

  const key = `feedback/${created_at.slice(0, 10)}/${id}.json`;

  await env.FEEDBACK_BUCKET.put(key, JSON.stringify(item), {
    httpMetadata: { contentType: "application/json" },
  });

  return json({ ok: true, id }, 200, CORS);
}
