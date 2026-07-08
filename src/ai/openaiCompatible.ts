import type { Finding, Stack } from "../core/types.js";
import { createFileAccess } from "../infra/fs.js";
import { toAiResult, type AiResult } from "./result.js";

/**
 * Shared OpenAI-compatible "single-call review" used by non-Anthropic providers
 * (GitHub Models, Gemini via its OpenAI-compat endpoint, or any internal
 * OpenAI-compatible gateway). One JSON-mode call — not the agentic tool loop —
 * which keeps it simple and gentle on prototyping rate limits.
 */

export interface OpenAICompatInput {
  root: string;
  stacks: Stack[];
  probeFindings: Finding[];
  rootEntries: string[];
  onActivity?: (line: string) => void;
}

export interface OpenAICompatConfig {
  /** Human label for spinners/errors, e.g. "Gemini". */
  label: string;
  /** Base URL up to (but not including) /chat/completions. */
  baseUrl: string;
  /** Bearer token / API key. */
  apiKey: string;
  model: string;
}

const SYSTEM_PROMPT = [
  "You are a senior engineer reviewing a codebase health report.",
  "Respond with a SINGLE JSON object of the form:",
  '{"narrative": string, "findings": [{"title": string, "detail": string,',
  '"severity": "info"|"warning"|"error", "file"?: string, "recommendation"?: string}]}.',
  "Base every finding on the provided context — do not invent files or code you were not shown.",
  "Prioritize and expand on the deterministic findings, and infer real risks from the",
  "dependencies and configuration. Prefer a few high-signal findings over many trivial ones.",
].join(" ");

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n[...truncated...]` : text;
}

/** Assemble a compact context bundle (single-call mode reads a few files, not the whole tree). */
function buildContext(input: OpenAICompatInput): string {
  const files = createFileAccess(input.root);

  const entries = input.rootEntries.map((e) => `  ${e}`).join("\n");
  const probes = input.probeFindings.length
    ? input.probeFindings
        .map((f) => {
          const loc = f.file ? ` (${f.file})` : "";
          return `- [${f.severity}] ${f.title}${loc}`;
        })
        .join("\n")
    : "(none)";

  const parts = [
    `Detected stacks: ${input.stacks.join(", ") || "unknown"}`,
    `Top-level entries:\n${entries}`,
    `Deterministic findings:\n${probes}`,
  ];

  const pkg = files.read("package.json");
  if (pkg) parts.push(`package.json:\n${truncate(pkg, 4000)}`);
  const tsconfig = files.read("tsconfig.json");
  if (tsconfig) parts.push(`tsconfig.json:\n${truncate(tsconfig, 1500)}`);

  return parts.join("\n\n");
}

export async function analyzeOpenAICompatible(
  input: OpenAICompatInput,
  config: OpenAICompatConfig,
): Promise<AiResult> {
  input.onActivity?.("gathering context");
  const context = buildContext(input);

  input.onActivity?.(`querying ${config.model}`);
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Return the JSON review for this project.\n\n${context}` },
        ],
      }),
    });
  } catch (err) {
    throw new Error(
      `${config.label} request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${config.label} ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";

  const parsed = extractJsonObject(content);
  if (parsed) return toAiResult(parsed);

  // Model returned unparseable prose — keep it as the narrative rather than failing.
  return {
    findings: [],
    narrative: content.trim() || `${config.label} returned an empty response.`,
  };
}

/**
 * Tolerantly extract a JSON object from a model response. Handles pure JSON,
 * ```json fenced``` blocks (Gemini/others often wrap output this way, which
 * plain JSON.parse chokes on), and surrounding prose by slicing the outermost
 * braces. Returns null if nothing parseable is found.
 */
function extractJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fence?.[1] ?? trimmed;

  const attempts = [body];
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) attempts.push(body.slice(start, end + 1));

  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object") return value as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}
