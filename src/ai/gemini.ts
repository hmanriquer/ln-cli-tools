import { analyzeOpenAICompatible, type OpenAICompatInput } from "./openaiCompatible.js";
import type { AiResult } from "./result.js";

/**
 * Google Gemini provider via its OpenAI-compatible endpoint. Auth is a Google
 * AI Studio API key (GEMINI_API_KEY) — a personal key works, independent of any
 * org. NOT Anthropic/Claude. Free-tier models (e.g. gemini-2.5-flash) suit a POC.
 *
 * ⚠️ Free-tier prompts may be used by Google to improve their products — avoid
 * sending proprietary code without sign-off.
 */

export interface GeminiAnalyzeInput extends OpenAICompatInput {
  model?: string;
}

const DEFAULT_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-2.5-flash";

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
}

export function geminiConfigured(): boolean {
  return Boolean(geminiKey());
}

export async function analyzeWithGemini(input: GeminiAnalyzeInput): Promise<AiResult> {
  const key = geminiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set — required for the Gemini provider.");
  }

  const baseUrl = process.env.HC_GEMINI_URL ?? DEFAULT_URL;
  const model = input.model ?? process.env.HC_GEMINI_MODEL ?? DEFAULT_MODEL;

  return analyzeOpenAICompatible(input, {
    label: "Gemini",
    baseUrl,
    apiKey: key,
    model,
  });
}
