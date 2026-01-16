export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const password = body?.password || "";

  const adminPassword = env.ADMIN_PASSWORD || "";
  if (!adminPassword) {
    return new Response(JSON.stringify({ error: "ADMIN_PASSWORD missing" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  if (password !== adminPassword) {
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // simpel token: in productie kun je dit later vervangen door JWT
  const token = crypto.randomUUID();

  // token returnen; Admin.jsx bewaart 'm in localStorage
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
