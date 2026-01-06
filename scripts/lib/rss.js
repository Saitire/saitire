// scripts/lib/rss.js
export async function fetchText(url, userAgent = "SAItirePublisher/1.0 (+rss)") {
  const res = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

export function parseRssItems(xml) {
  const blocks = String(xml).split("<item>").slice(1).map((x) => x.split("</item>")[0]);
  return blocks.map((b) => ({
    title: getTag(b, "title"),
    link: getTag(b, "link"),
    pubDate: getTag(b, "pubDate"),
  }));
}

function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  return decodeHtml(stripCdata(m[1].trim()));
}

function stripCdata(s) {
  return s.replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "");
}

function decodeHtml(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
