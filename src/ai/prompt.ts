import type { Finding, Stack } from "../core/types.js";

export const SYSTEM_PROMPT = `You are a senior engineer performing a read-only health check of a codebase.

Your job is to INVESTIGATE and REPORT — never to change anything. You have read-only
tools (list_dir, read_file, glob, grep). Use them to verify claims against the actual
code rather than guessing. The user will decide whether to act on your findings.

Guidelines:
- Ground every finding in something you actually read. Reference the file when you can.
- Focus on things a linter or version check would miss: architectural smells, risky
  patterns, missing error handling at boundaries, security-sensitive code, dead or
  duplicated logic, and gaps between config and actual usage.
- Do NOT repeat the deterministic findings already provided unless you can add specific,
  file-level detail that materially helps.
- Prefer a few high-signal findings over many low-value ones.
- Severity: "error" = likely to cause incorrect behavior, a break, or a security issue;
  "warning" = risky or clearly suboptimal; "info" = worth knowing.
- Be concise. When you are done investigating, call submit_findings exactly once and stop.`;

export function buildUserPrompt(
  stacks: Stack[],
  probeFindings: Finding[],
  rootEntries: string[],
): string {
  const probeSummary =
    probeFindings.length === 0
      ? "(none)"
      : probeFindings
          .map((f) => `- [${f.severity}] ${f.title}${f.file ? ` (${f.file})` : ""}`)
          .join("\n");

  return [
    `Detected stack(s): ${stacks.join(", ") || "unknown"}.`,
    ``,
    `Top-level entries:`,
    rootEntries.map((e) => `  ${e}`).join("\n"),
    ``,
    `Deterministic checks already produced these findings (do not simply restate them):`,
    probeSummary,
    ``,
    `Investigate the project and identify the most important issues a static check would`,
    `miss. Start by orienting yourself (list_dir, read package.json and key config), then`,
    `dig into the source. Call submit_findings when done.`,
  ].join("\n");
}
