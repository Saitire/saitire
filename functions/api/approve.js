// functions/api/approve.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function handleOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return Boolean(env.ADMIN_PASSWORD && token && token === env.ADMIN_PASSWORD);
}

async function readArray(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return [];
  try {
    const v = JSON.parse(await obj.text());
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function writeArray(bucket, key, arr) {
  await bucket.put(key, JSON.stringify(arr), {
    httpMetadata: { contentType: "application/json" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeApprovedItem(item) {
  const created = item?.created_date || item?.created_at || nowIso();

  return {
    ...item,
    id: item?.id || randomId(),
    created_date: created,

    // match jouw huidige "live artikel" semantic:
    review_status: "approved_by_human",

    // optioneel toekomst-proof (maakt isPublished ook waar):
    published_at: item?.published_at || nowIso(),
    is_published: true,
  };
}

async function handlePost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401, CORS);
  if (!env.PENDING_BUCKET) return json({ error: "PENDING_BUCKET binding missing" }, 500, CORS);
  if (!env.PUBLISHED_BUCKET) return json({ error: "PUBLISHED_BUCKET binding missing" }, 500, CORS);

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!id) return json({ error: "id required" }, 400, CORS);

  const pending = await readArray(env.PENDING_BUCKET, "pending.json");
  const idx = pending.findIndex((x) => String(x?.id || "") === id);
  if (idx < 0) return json({ error: "Not found" }, 404, CORS);

  const item = pending[idx];
  pending.splice(idx, 1);

  const published = await readArray(env.PUBLISHED_BUCKET, "articles.json");
  const approved = normalizeApprovedItem(item);

  // dedupe by id/slug
  const key = String(approved.id || approved.slug || "");
  const nextPublished = [approved, ...published.filter((x) => {
    const k = String(x?.id || x?.slug || "");
    return k && k !== key;
  })].slice(0, 2000);

  await writeArray(env.PENDING_BUCKET, "pending.json", pending);
  await writeArray(env.PUBLISHED_BUCKET, "articles.json", nextPublished);

  return json({ ok: true, id: approved.id }, 200, CORS);
}

export function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  return handlePost(context);
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === "OPTIONS") return handleOptions();
  if (method === "POST") return handlePost(context);
  return json({ error: "Method Not Allowed" }, 405, CORS);
}
