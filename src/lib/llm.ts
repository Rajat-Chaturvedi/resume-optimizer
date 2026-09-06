import { LLM } from "@/constants/config";

type ChatMessage = { role: "system" | "user"; content: string };

const DEFAULT_MODEL = process.env.LLM_MODEL ?? LLM.defaultModel;
const BASE_URL = process.env.LLM_BASE_URL ?? LLM.defaultBaseUrl;

export function llmEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Calls an OpenAI-compatible chat completions endpoint and returns parsed JSON.
 * Returns null when no key is configured or the call fails, so callers can fall
 * back to the deterministic engine.
 */
export async function llmJson<T>(messages: ChatMessage[], maxTokens: number = LLM.rewriteMaxTokens): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM.timeoutMs);
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: LLM.temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("LLM request failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch (err) {
    console.error("LLM request error", err);
    return null;
  }
}
