function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function loadSeedArticlesArray(request) {
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

async function loadR2Published(env) {
  if (!env.PUBLISHED_BUCKET) return { ok: true, data: [] }; // allow bootstrapping without breaking site

  const obj = await env.PUBLISHED_BUCKET.get("articles.json");
  if (!obj) return { ok: true, data: [] };

  try {
    const data = JSON.parse(await obj.text());
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: true, data: [] };
  }
}

function isPublished(a) {
  const rs = String(a?.review_status || "").toLowerCase();

  // bestaande/live compat
  if (rs === "approved_by_human") return true;

  // nieuwe flow (approve endpoint)
  if (rs === "approved" || rs === "published" || rs === "live") return true;

  if (a?.published_at) return true;
  if (a?.is_published === true) return true;

  return false;
}

function dedupeByIdOrSlug(items) {
  const out = [];
  const seen = new Set();

  for (const a of items || []) {
    const k = String(a?.id || a?.slug || "");
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  const seed = await loadSeedArticlesArray(request);
  if (!seed.ok) {
    return json(
      {
        error: `Could not load /articles.json (HTTP ${seed.status})`,
        detail: (seed.text || "").slice(0, 200),
      },
      500,
      CORS
    );
  }

  const r2 = await loadR2Published(env);

  // R2 first so newly approved items win in dedupe
  const merged = dedupeByIdOrSlug([...(r2.data || []), ...(seed.data || [])]);

  const published = merged.filter(isPublished);

  published.sort((a, b) => {
    const da = new Date(a?.created_date || 0).getTime() || 0;
    const db = new Date(b?.created_date || 0).getTime() || 0;
    return db - da;
  });

  return json({ published }, 200, CORS);
}
