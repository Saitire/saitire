// functions/api/feedback.js

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function clamp(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n) : t;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

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

  const id = crypto.randomUUID();
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
