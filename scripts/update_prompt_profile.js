// scripts/update_prompt_profile.js
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import "dotenv/config";

const FEEDBACK_PATH = path.join(process.cwd(), "reviews", "feedback.jsonl");
const PROFILE_PATH = path.join(process.cwd(), "scripts", "prompt_profile.json");

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ontbreekt (update_prompt_profile kan niet draaien zonder key).");
  return new OpenAI({ apiKey });
}

function readLines(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
}

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

async function summarizeFeedback(openai, feedbackItems) {
  const prompt = `
Je bent hoofdredacteur.

Hieronder staat feedback van een menselijke eindredacteur op satirische artikelen.
Vat dit samen tot duidelijke, toepasbare SCHRIJFREGELS voor een AI-schrijver.

Feedback:
${feedbackItems.map((f, i) => `${i + 1}. ${f.feedback}`).join("\n")}

Output als geldige JSON:
{
  "rules": [
    "regel 1",
    "regel 2",
    "..."
  ]
}

Regels:
- Maximaal 6 regels
- Concreet (“vermijd X”, “doe Y”)
- Gericht op humor, toon, actualiteit, punchlines
- Geen meta-tekst
`.trim();

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(res.choices?.[0]?.message?.content || "{}");
}

async function main() {
  const lines = readLines(FEEDBACK_PATH);
  if (lines.length === 0) {
    console.log("Geen feedback gevonden.");
    return;
  }

  const feedbackItems = lines
    .map((l) => JSON.parse(l))
    .filter((x) => x.action === "reject" && x.feedback)
    .slice(-20);

  if (feedbackItems.length === 0) {
    console.log("Geen bruikbare feedback.");
    return;
  }

  const openai = getOpenAI();
  const summary = await summarizeFeedback(openai, feedbackItems);

  const profile = readJson(PROFILE_PATH, { rules: [] });

  const mergedRules = [...profile.rules, ...(summary.rules || [])];
  const uniqueRules = [...new Set(mergedRules)].slice(-10);

  writeJson(PROFILE_PATH, {
    ...profile,
    rules: uniqueRules,
    updated_at: new Date().toISOString(),
  });

  console.log("Prompt-profiel bijgewerkt met regels:");
  uniqueRules.forEach((r) => console.log("-", r));
}

main().catch((e) => {
  console.error("FOUT:", e?.stack || e);
  process.exit(1);
});
