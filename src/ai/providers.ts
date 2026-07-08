import { resolveModel, type Effort } from "../config.js";
import type { Finding, Stack } from "../core/types.js";
import { hasCredentials } from "../infra/credentials.js";
import { analyze } from "./analyze.js";
import { createClient } from "./client.js";
import { analyzeWithGitHubModels, githubModelsConfigured } from "./githubModels.js";
import { analyzeWithGemini, geminiConfigured } from "./gemini.js";
import type { AiResult } from "./result.js";

export type ProviderId = "anthropic" | "github-models" | "gemini";

/** Valid values for the --provider flag. */
export const PROVIDER_CHOICES = ["auto", "anthropic", "github-models", "gemini"] as const;

export interface AnalyzeInput {
  root: string;
  /** Model override (--model). Provider-specific default applies when omitted. */
  model?: string;
  effort: Effort;
  stacks: Stack[];
  probeFindings: Finding[];
  rootEntries: string[];
  onActivity?: (line: string) => void;
}

const LABELS: Record<ProviderId, string> = {
  anthropic: "Claude (Anthropic)",
  "github-models": "GitHub Models",
  gemini: "Gemini",
};

export function providerLabel(id: ProviderId): string {
  return LABELS[id];
}

export function providerConfigured(id: ProviderId): boolean {
  switch (id) {
    case "anthropic":
      return hasCredentials();
    case "github-models":
      return githubModelsConfigured();
    case "gemini":
      return geminiConfigured();
  }
}

export { githubModelsConfigured, geminiConfigured };

/**
 * Resolve which provider to use. An explicit id is honored as-is (even if not
 * yet configured, so the caller can report a precise reason). "auto"/undefined
 * picks the first configured provider, or null when none are.
 */
export function resolveProviderId(requested?: string): ProviderId | null {
  if (requested === "anthropic" || requested === "github-models" || requested === "gemini") {
    return requested;
  }
  if (hasCredentials()) return "anthropic";
  if (githubModelsConfigured()) return "github-models";
  if (geminiConfigured()) return "gemini";
  return null;
}

export async function analyzeWith(id: ProviderId, input: AnalyzeInput): Promise<AiResult> {
  if (id === "anthropic") {
    return analyze({
      client: createClient(),
      root: input.root,
      model: resolveModel(input.model),
      effort: input.effort,
      stacks: input.stacks,
      probeFindings: input.probeFindings,
      rootEntries: input.rootEntries,
      onActivity: input.onActivity,
    });
  }

  const compatInput = {
    root: input.root,
    model: input.model,
    stacks: input.stacks,
    probeFindings: input.probeFindings,
    rootEntries: input.rootEntries,
    onActivity: input.onActivity,
  };
  return id === "gemini"
    ? analyzeWithGemini(compatInput)
    : analyzeWithGitHubModels(compatInput);
}
