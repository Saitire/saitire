function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return Boolean(env.ADMIN_PASSWORD && token && token === env.ADMIN_PASSWORD);
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

  if (!env.PENDING_BUCKET) return json({ error: "PENDING_BUCKET binding missing" }, 500);

  const obj = await env.PENDING_BUCKET.get("pending.json");
  if (!obj) return json({ pending: [] }, 200);

  let pending = [];
  try {
    pending = JSON.parse(await obj.text());
  } catch {
    pending = [];
  }

  return json({ pending }, 200);
}
