export async function onRequestGet() {
  // tijdelijk: lege lijst zodat admin in elk geval niet crasht
  return new Response(JSON.stringify({ published: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}