import type { Finding, Severity } from "../core/types.js";

export interface AiResult {
  findings: Finding[];
  narrative?: string;
}

const VALID_SEVERITY: ReadonlySet<Severity> = new Set(["info", "warning", "error"]);

/**
 * Normalize a `{ narrative, findings[] }` object — whether it came from a
 * Claude `submit_findings` tool call or a GitHub Models JSON response — into a
 * validated AiResult. Provider-agnostic on purpose.
 */
export function toAiResult(input: unknown): AiResult {
  const obj = (input ?? {}) as Record<string, unknown>;
  const narrative = typeof obj["narrative"] === "string" ? (obj["narrative"] as string) : undefined;
  const raw = Array.isArray(obj["findings"]) ? (obj["findings"] as unknown[]) : [];
  const findings: Finding[] = raw.map((item, i) => {
    const f = (item ?? {}) as Record<string, unknown>;
    const severity = f["severity"] as Severity;
    return {
      id: `ai/${i + 1}`,
      source: "ai" as const,
      severity: VALID_SEVERITY.has(severity) ? severity : "info",
      title: String(f["title"] ?? "Untitled finding"),
      detail: String(f["detail"] ?? ""),
      ...(typeof f["file"] === "string" ? { file: f["file"] as string } : {}),
      ...(typeof f["recommendation"] === "string"
        ? { recommendation: f["recommendation"] as string }
        : {}),
    };
  });
  return { findings, narrative };
}
