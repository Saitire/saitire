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

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return Boolean(env.ADMIN_PASSWORD && token && token === env.ADMIN_PASSWORD);
}

async function findFeedbackKeyById(bucket, id) {
  let cursor;
  for (let i = 0; i < 50; i++) {
    const listed = await bucket.list({ prefix: "feedback/", cursor });
    const objects = listed?.objects || [];
    const hit = objects.find((o) => o.key && o.key.endsWith(`/${id}.json`));
    if (hit?.key) return hit.key;

    if (!listed?.truncated) break;
    cursor = listed?.cursor;
    if (!cursor) break;
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  if (!env.FEEDBACK_BUCKET) return json({ error: "FEEDBACK_BUCKET binding missing" }, 500, CORS);
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401, CORS);

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!id) return json({ error: "id required" }, 400, CORS);

  const key = await findFeedbackKeyById(env.FEEDBACK_BUCKET, id);
  if (!key) return json({ error: "Not found" }, 404, CORS);

  await env.FEEDBACK_BUCKET.delete(key);

  return json({ ok: true, id }, 200, CORS);
}
