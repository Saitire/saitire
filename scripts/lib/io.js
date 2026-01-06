// scripts/lib/io.js
import fs from "node:fs";
import path from "node:path";

export function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...rest] = a.slice(2).split("=");
      out[k] = rest.length ? rest.join("=") : true;
    }
  }
  return out;
}

export function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function readJsonArray(p) {
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw || "[]");
  return Array.isArray(data) ? data : [];
}

export function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw || JSON.stringify(fallback));
}

export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function writeJsonFile(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}
