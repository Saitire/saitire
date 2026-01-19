// functions/api/feedback_list.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
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

export async function onRequestGet({ request, env }) {
  if (!env.FEEDBACK_BUCKET) return json({ error: "FEEDBACK_BUCKET binding missing" }, 500, CORS);
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401, CORS);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 100)));

  const listed = await env.FEEDBACK_BUCKET.list({ prefix: "feedback/" });

  const keys = (listed.objects || [])
    .map((o) => o.key)
    .sort()
    .reverse()
    .slice(0, limit);

  const feedback = [];
  for (const key of keys) {
    const obj = await env.FEEDBACK_BUCKET.get(key);
    if (!obj) continue;
    try {
      feedback.push(JSON.parse(await obj.text()));
    } catch {}
  }

  return json({ feedback }, 200, CORS);
}
