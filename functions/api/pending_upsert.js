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

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.PENDING_BUCKET) return json({ error: "PENDING_BUCKET binding missing" }, 500);

  const body = await request.json().catch(() => ({}));
  const item = body?.item;

  if (!item || !item.id) return json({ error: "item with id required" }, 400);

  const obj = await env.PENDING_BUCKET.get("pending.json");
  let pending = [];
  if (obj) {
    try { pending = JSON.parse(await obj.text()); } catch { pending = []; }
  }

  // prepend newest
  pending = [item, ...pending.filter((x) => x?.id !== item.id)].slice(0, 500);

  await env.PENDING_BUCKET.put("pending.json", JSON.stringify(pending), {
    httpMetadata: { contentType: "application/json" },
  });

  return json({ ok: true, count: pending.length }, 200);
}
