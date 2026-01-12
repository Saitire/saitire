// scripts/generateImage.js
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Replicate from "replicate";

// pin op een specifieke versie (stable)
const MODEL = "jyoung105/sdxl-turbo:f15ca635c7ff44f550c112a247966be926ee8699035a738bb8bde9bdac5aec70";
const OUT_DIR = path.join(process.cwd(), "public", "images");

// -------------------- helpers --------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hash(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function buildPrompt({ title, summary, category }) {
  return clean(
    [
      "satirical editorial illustration",
      "dry humor",
      "modern newspaper style",
      "single clear scene",
      "clean composition",
      "no text",
      "no watermark",
      category ? `category vibe: ${category}` : "",
      title ? `title concept: ${title}` : "",
      summary ? `context: ${summary}` : "",
    ].filter(Boolean).join(", ")
  );
}

// -------------------- main --------------------
export async function generateImage({
  slug,
  title = "",
  summary = "",
  category = "",
  force = false,
  steps = 4,
}) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN ontbreekt");
  }
  if (!slug) {
    throw new Error("generateImage: slug is verplicht");
  }

  ensureDir(OUT_DIR);

  const prompt = buildPrompt({
    title: clean(title),
    summary: clean(summary),
    category: clean(category),
  });

  const promptHash = hash(prompt);
  const filename = `${slug}-${promptHash}.webp`;
  const absPath = path.join(OUT_DIR, filename);
  const publicUrl = `/images/${filename}`;

  // Cache hit
  if (!force && fs.existsSync(absPath)) {
    return {
      url: publicUrl,
      cached: true,
      prompt,
    };
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const output = await replicate.run(MODEL, {
    input: {
        prompt,
        width: 1024,
        height: 1024,
        num_images: 1,
        steps: Math.max(1, Math.min(steps, 8)),
        guidance_scale: 0,
    },
    });


  const imageUrl = Array.isArray(output) ? output[0] : null;
  if (!imageUrl) {
    throw new Error("Replicate gaf geen image URL terug");
  }

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Download image faalde (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(absPath, buffer);

  return {
    url: publicUrl,
    cached: false,
    prompt,
  };
}
