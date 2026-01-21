// functions/api/reject.js
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

function clamp(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n) : t;
}

async function handlePost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401, CORS);
  if (!env.PENDING_BUCKET) return json({ error: "PENDING_BUCKET binding missing" }, 500, CORS);

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  const feedback = clamp(body?.feedback || "", 5000);

  if (!id) return json({ error: "id required" }, 400, CORS);

  const pending = await readArray(env.PENDING_BUCKET, "pending.json");
  const idx = pending.findIndex((x) => String(x?.id || "") === id);
  if (idx < 0) return json({ error: "Not found" }, 404, CORS);

  const item = pending[idx];
  pending.splice(idx, 1);

  await writeArray(env.PENDING_BUCKET, "pending.json", pending);

  // Log admin feedback into FEEDBACK_BUCKET (if available) so Admin "Feedback" tab can show it.
  if (env.FEEDBACK_BUCKET && feedback) {
    const created_at = new Date().toISOString();
    const key = `reject/${created_at.slice(0, 10)}/${id}.json`;

    const payload = {
      id,
      type: "reject",
      title: clamp(item?.title || "", 140),
      message: feedback,
      url: clamp(item?.slug ? `/${item.slug}` : "", 500),
      email: "",
      created_at,
      resolved: false,
      page_url: "",
      user_agent: "admin",
    };

    await env.FEEDBACK_BUCKET.put(key, JSON.stringify(payload), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  return json({ ok: true, id }, 200, CORS);
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
