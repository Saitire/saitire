function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestGet() {
  return json({
    published: [
      {
        id: "test-1",
        slug: "test-article",
        category: "test",
        title: "Test: admin geplaatst werkt",
        subtitle: "Als je dit ziet, is de admin-koppeling goed.",
        content: "Dit is een test.",
        created_date: new Date().toISOString(),
        image_url: null,
      },
    ],
  });
}