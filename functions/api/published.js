function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestGet() {
  return json({ published: [] });
}

export async function onRequestPost() {
  return json({ published: [] });
}