function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function loadArticlesArray(request) {
  const url = new URL(request.url);
  url.pathname = "/articles.json";
  url.search = "";

  const resp = await fetch(url.toString(), { headers: { "cache-control": "no-cache" } });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, text };
  }

  const data = await resp.json().catch(() => null);
  if (!Array.isArray(data)) {
    return { ok: false, status: 500, text: "Expected /articles.json to be an array" };
  }

  return { ok: true, data };
}

function isPublished(a) {
  const rs = String(a?.review_status || "").toLowerCase();
  // jouw live artikel: "approved_by_human"
  if (rs === "approved_by_human") return true;

  // eventueel toekomst-proof:
  if (rs === "published" || rs === "live") return true;

  // als je later een expliciete published_at of is_published toevoegt:
  if (a?.published_at) return true;
  if (a?.is_published === true) return true;

  return false;
}

export async function onRequestGet({ request }) {
  const loaded = await loadArticlesArray(request);
  if (!loaded.ok) {
    return json(
      {
        error: `Could not load /articles.json (HTTP ${loaded.status})`,
        detail: (loaded.text || "").slice(0, 200),
      },
      500
    );
  }

  const published = loaded.data.filter(isPublished);

  // newest first
  published.sort((a, b) => {
    const da = new Date(a?.created_date || 0).getTime() || 0;
    const db = new Date(b?.created_date || 0).getTime() || 0;
    return db - da;
  });

  return json({ published });
}
