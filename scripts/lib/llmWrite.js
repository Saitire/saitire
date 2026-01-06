// scripts/lib/llmWrite.js
import Anthropic from "@anthropic-ai/sdk";

/**
 * Schrijf-LMM wrapper: gebruikt Claude alléén voor investigations,
 * en OpenAI voor alles anders.
 */
export async function writeText(ctx, { prompt, temperature, maxTokens, useClaude }) {
  if (useClaude) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ontbreekt voor Claude schrijven.");

    const anthropic = new Anthropic({ apiKey });

    const res = await anthropic.messages.create({
      model: process.env.CLAUDE_WRITE_MODEL || "claude-sonnet-4-20250514",
      max_tokens: Math.min(maxTokens ?? 1024, 1024),
      temperature: temperature ?? 0.85,
      messages: [{ role: "user", content: prompt }],
    });

    // Claude response: array met content blocks
    const txt = res?.content?.map((c) => (c.type === "text" ? c.text : "")).join("") || "";
    return txt;
  }

  // Default: OpenAI
  const res = await ctx.openai.chat.completions.create({
    model: ctx.WRITE_MODEL,
    temperature: temperature ?? (ctx.WRITE_TEMPERATURE ?? 0.85),
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices?.[0]?.message?.content || "";
}
