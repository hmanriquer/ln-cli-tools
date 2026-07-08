import type { Stack } from "../core/types.js";
import { credentialsDisplayPath } from "../infra/credentials.js";
import {
  promptConfirm,
  promptPassword,
  promptSelect,
  promptText,
} from "../ui/prompts.js";
import { logInfo, logWarn } from "../ui/notice.js";

export interface InteractiveAnswers {
  stack: Stack | "auto";
  path: string;
  ai: boolean;
}

function bail(): never {
  console.log("Cancelled.");
  process.exit(130);
}

/** Prompt for the missing pieces when `hc check` is run bare in a TTY. */
export async function promptForCheck(): Promise<InteractiveAnswers> {
  const stack = await promptSelect<Stack | "auto">("Which stack?", [
    { value: "auto", label: "Auto-detect", hint: "recommended" },
    { value: "node", label: "Node.js" },
    { value: "react", label: "React" },
    { value: "angular", label: "Angular" },
  ]);
  if (stack === null) bail();

  const projectPath = await promptText({
    message: "Project path",
    placeholder: ".",
    defaultValue: ".",
  });
  if (projectPath === null) bail();

  const ai = await promptConfirm("Run AI analysis?", true);
  if (ai === null) bail();

  return { stack, path: projectPath || ".", ai };
}

export interface ApiKeyResult {
  key: string;
  save: boolean;
}

/**
 * Prompt the user for an Anthropic API key (masked). Returns null if they skip
 * or cancel — the caller then runs deterministic probes only.
 * Pass `{ silent: true }` when updating an existing key (skips the "not found" warning).
 */
export async function promptForApiKey(opts?: {
  silent?: boolean;
}): Promise<ApiKeyResult | null> {
  if (!opts?.silent) {
    logWarn(
      "No Anthropic credentials found. Paste an API key below, or cancel and run " +
        "`ant auth login` to authenticate with OAuth instead.",
    );
  }

  const key = await promptPassword({
    message: "Paste your Anthropic API key (Enter to skip AI)",
    validate: (value) => {
      if (!value) return undefined; // blank = skip, allowed
      if (!value.startsWith("sk-ant-")) {
        return "That doesn't look like an Anthropic key (expected it to start with sk-ant-).";
      }
      return undefined;
    },
  });
  if (key === null) return null;

  const trimmed = key.trim();
  if (!trimmed) {
    logInfo("Skipping AI — running deterministic probes only.");
    return null;
  }

  const save = await promptConfirm(
    `Save it to ${credentialsDisplayPath()} for next time?`,
    true,
  );
  if (save === null) return { key: trimmed, save: false };

  return { key: trimmed, save };
}

export interface GitHubTokenResult {
  token: string;
  save: boolean;
}

const GITHUB_TOKEN_RE = /^(github_pat_|ghp_|gho_|ghu_|ghs_)/;

/**
 * Prompt for a GitHub token (masked) for the GitHub Models provider. Returns
 * null if the user skips or cancels.
 */
export async function promptForGitHubToken(opts?: {
  silent?: boolean;
}): Promise<GitHubTokenResult | null> {
  if (!opts?.silent) {
    logWarn("No GITHUB_TOKEN found — needed for the GitHub Models provider.");
  }

  const token = await promptPassword({
    message:
      "Paste your GitHub token (PAT with the models permission; Enter to skip)",
    validate: (value) => {
      if (!value) return undefined; // blank = skip
      if (!GITHUB_TOKEN_RE.test(value)) {
        return "That doesn't look like a GitHub token (expected e.g. github_pat_… or ghp_…).";
      }
      return undefined;
    },
  });
  if (token === null) return null;

  const trimmed = token.trim();
  if (!trimmed) {
    logInfo("Skipping — no GitHub token set.");
    return null;
  }

  const save = await promptConfirm(
    `Save it to ${credentialsDisplayPath()} for next time?`,
    true,
  );
  if (save === null) return { token: trimmed, save: false };

  return { token: trimmed, save };
}

export interface GeminiKeyResult {
  key: string;
  save: boolean;
}

/** Prompt for a Google AI Studio (Gemini) API key (masked). */
export async function promptForGeminiKey(opts?: {
  silent?: boolean;
}): Promise<GeminiKeyResult | null> {
  if (!opts?.silent) {
    logWarn("No GEMINI_API_KEY found — needed for the Gemini provider.");
  }

  const key = await promptPassword({
    message: "Paste your Gemini API key (from Google AI Studio; Enter to skip)",
    validate: (value) => {
      if (!value) return undefined; // blank = skip
      if (value.length < 20) return "That doesn't look like a Gemini API key.";
      return undefined;
    },
  });
  if (key === null) return null;

  const trimmed = key.trim();
  if (!trimmed) {
    logInfo("Skipping — no Gemini key set.");
    return null;
  }

  const save = await promptConfirm(
    `Save it to ${credentialsDisplayPath()} for next time?`,
    true,
  );
  if (save === null) return { key: trimmed, save: false };

  return { key: trimmed, save };
}
