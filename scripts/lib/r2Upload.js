// scripts/lib/r2Upload.js
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

console.log("[r2Upload] MODULE LOADED", import.meta.url);

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ontbreekt`);
  return v;
}

function rid(prefix = "r2") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function log(msg, extra) {
  const base = `[r2Upload] ${msg}`;
  if (extra !== undefined) console.log(base, extra);
  else console.log(base);
}

function contentTypeFromExt(ext) {
  const e = String(ext || "").toLowerCase().replace(/^\./, "");
  if (e === "webp") return "image/webp";
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function extFromContentType(ct) {
  const t = String(ct || "").toLowerCase();
  if (t.includes("image/webp")) return "webp";
  if (t.includes("image/png")) return "png";
  if (t.includes("image/jpeg")) return "jpg";
  return null; // bewust null: geen image => error
}

function extFromUrl(u) {
  try {
    const p = new URL(u, "http://x").pathname;
    const ext = path.extname(p).replace(".", "").toLowerCase();
    return ext || null;
  } catch {
    return null;
  }
}

function keyFor({ slug, ext }) {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `articles/${yyyy}/${mm}/${slug}.${ext}`;
}

function guessBaseUrl() {
  if (process.env.IMAGE_BASE_URL) return process.env.IMAGE_BASE_URL;
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL;
  if (process.env.CF_PAGES_URL) return process.env.CF_PAGES_URL;

  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  if (nodeEnv !== "production") {
    return process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  }
  throw new Error(
    "Relatieve imageUrl maar geen base gevonden. Zet IMAGE_BASE_URL of PUBLIC_SITE_URL."
  );
}

function normalizeImageUrl(imageUrl) {
  const raw = String(imageUrl || "").trim();
  if (!raw) throw new Error("imageUrl ontbreekt");
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = guessBaseUrl().replace(/\/$/, "");
  return new URL(raw, base + "/").toString();
}

async function safeTextPreview(resp) {
  try {
    const txt = await resp.text();
    return txt.slice(0, 200).replace(/\s+/g, " ").trim();
  } catch {
    return "(no body preview)";
  }
}

/**
 * Haal image bytes op:
 * - Als imageUrl begint met "/images/" -> lees lokaal bestand (default: <project>/public)
 * - Anders -> fetch via http(s)
 */
async function loadImageBytes({ imageUrl, requestId }) {
  const raw = String(imageUrl || "").trim();

  // 1) lokaal pad (dit is jouw geval)
  if (raw.startsWith("/images/")) {
    const baseDir =
      process.env.IMAGE_LOCAL_DIR || path.join(process.cwd(), "public");
    const filePath = path.join(baseDir, raw.replace(/^\//, "")); // "images/..."
    log("local read", { requestId, filePath });

    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const ct = contentTypeFromExt(ext);

    if (!ct.startsWith("image/")) {
      throw new Error(`Local file is not an image? ct=${ct} path=${filePath}`);
    }

    return { body, contentType: ct };
  }

  // 2) via http(s)
  const absoluteUrl = normalizeImageUrl(raw);
  log("fetch", { requestId, absoluteUrl });

  const resp = await fetch(absoluteUrl, {
    headers: { "user-agent": "saitire-r2-upload/1.0" },
    redirect: "follow",
  });

  log("download response", {
    requestId,
    status: resp.status,
    ok: resp.ok,
    contentType: resp.headers.get("content-type"),
    contentLength: resp.headers.get("content-length"),
  });

  if (!resp.ok) {
    const preview = await safeTextPreview(resp);
    throw new Error(
      `Download image failed: ${resp.status} ${resp.statusText} | ${preview}`
    );
  }

  const ct = resp.headers.get("content-type") || "";
  const extFromCt = extFromContentType(ct);

  // HARD FAIL als het geen image is (voorkomt HTML upload)
  if (!ct.toLowerCase().startsWith("image/") || !extFromCt) {
    const preview = await safeTextPreview(resp);
    throw new Error(
      `Downloaded content is not an image. content-type=${ct || "(missing)"} | preview=${preview}`
    );
  }

  const ab = await resp.arrayBuffer();
  const body = Buffer.from(ab);

  return { body, contentType: ct };
}

export async function uploadImageUrlToR2({ imageUrl, slug, requestId } = {}) {
  const reqId = requestId || rid("img");
  const started = Date.now();

  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET");
  const publicBase = required("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  log("start", { requestId: reqId, slug, imageUrl });
  log("config", { requestId: reqId, endpoint, bucket, publicBase });

  const { body, contentType } = await loadImageBytes({ imageUrl, requestId: reqId });
  log("bytes", { requestId: reqId, bytes: body.length, contentType });

  // ext bepalen: uit contentType (beste) of uit url
  const ext =
    extFromContentType(contentType) ||
    extFromUrl(imageUrl) ||
    "png";

  const key = keyFor({ slug, ext });

  const putRes = await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  log("putObject OK", { requestId: reqId, key, etag: putRes?.ETag });

  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    log("headObject OK", {
      requestId: reqId,
      contentLength: head?.ContentLength,
      contentType: head?.ContentType,
      etag: head?.ETag,
    });
  } catch (e) {
    log("headObject FAILED (non-fatal)", {
      requestId: reqId,
      name: e?.name,
      message: e?.message,
    });
  }

  const url = `${publicBase}/${key}`;
  log("public url", { requestId: reqId, url });
  log("done", { requestId: reqId, totalMs: Date.now() - started });

  return { url, key, contentType, etag: putRes?.ETag, size: body.length };
}
