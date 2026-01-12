// scripts/lib/llmWrite.js
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Schrijf-LLM wrapper: gebruikt Claude voor alles.
 * (Geen OpenAI.)
 */
export async function writeText(ctx, { prompt, temperature, maxTokens, useClaude } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ontbreekt.");

  const anthropic = new Anthropic({ apiKey });

  const model =
    process.env.CLAUDE_WRITE_MODEL ||
    (useClaude ? "claude-sonnet-4-20250514" : "claude-sonnet-4-20250514");

  const res = await anthropic.messages.create({
    model,
    max_tokens: Math.min(maxTokens ?? 1200, 4096),
    temperature: temperature ?? (ctx?.WRITE_TEMPERATURE ?? 0.85),
    messages: [{ role: "user", content: prompt }],
  });

  return res?.content?.map((c) => (c.type === "text" ? c.text : "")).join("") || "";
}
