export async function onRequestGet() {
  return new Response(JSON.stringify({ pending: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}