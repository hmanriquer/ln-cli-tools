import { analyzeOpenAICompatible, type OpenAICompatInput } from "./openaiCompatible.js";
import type { AiResult } from "./result.js";

/**
 * GitHub Models provider — OpenAI-compatible inference authenticated with a
 * GitHub PAT (Models: Read-only). NOT Anthropic/Claude: the catalog is OpenAI /
 * Meta / Mistral / Cohere / DeepSeek / Microsoft. Model ids are "publisher/model".
 */

export interface GitHubAnalyzeInput extends OpenAICompatInput {
  model?: string;
}

const DEFAULT_URL = "https://models.github.ai/inference";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

function ghToken(): string | undefined {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
}

export function githubModelsConfigured(): boolean {
  return Boolean(ghToken());
}

export async function analyzeWithGitHubModels(input: GitHubAnalyzeInput): Promise<AiResult> {
  const token = ghToken();
  if (!token) {
    throw new Error("GITHUB_TOKEN (or GH_TOKEN) is not set — required for the GitHub Models provider.");
  }

  const baseUrl = process.env.HC_GITHUB_MODELS_URL ?? DEFAULT_URL;
  const model = input.model ?? process.env.HC_GITHUB_MODEL ?? DEFAULT_MODEL;

  // GitHub Models ids are "publisher/model" (e.g. openai/gpt-4o-mini). A bare
  // name is rejected server-side with a confusing "No Access to model" 403.
  if (!model.includes("/")) {
    throw new Error(
      `GitHub Models needs a "publisher/model" id (e.g. openai/gpt-4o-mini); you set "${model}".`,
    );
  }

  return analyzeOpenAICompatible(input, {
    label: "GitHub Models",
    baseUrl,
    apiKey: token,
    model,
  });
}
