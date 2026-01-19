function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
  });
}

// Als je site en API op hetzelfde domein zitten, is CORS meestal niet nodig.
// Maar als je per ongeluk vanaf een preview/pages.dev of ander domein post,
// dan heb je deze headers nodig. Dit maakt het robuust.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  const message = String(body?.message || "").trim();
  const title = String(body?.title || "").trim();
  const url = String(body?.url || "").trim();
  const type = String(body?.type || "feedback").trim();

  if (!message) return json({ error: "Message required" }, 400, CORS_HEADERS);

  // Tijdelijk: we accepteren het en loggen het.
  // Later kunnen we dit opslaan in R2/D1.
  console.log("[feedback]", { type, title, url, message: message.slice(0, 200) });

  return json({ ok: true }, 200, CORS_HEADERS);
}