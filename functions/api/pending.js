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
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401, CORS);
  if (!env.PENDING_BUCKET) return json({ error: "PENDING_BUCKET binding missing" }, 500, CORS);

  const obj = await env.PENDING_BUCKET.get("pending.json");
  if (!obj) return json({ pending: [] }, 200, CORS);

  let pending = [];
  try {
    pending = JSON.parse(await obj.text());
    if (!Array.isArray(pending)) pending = [];
  } catch {
    pending = [];
  }

  return json({ pending }, 200, CORS);
}
