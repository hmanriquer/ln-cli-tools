import type { Finding, HealthReport } from "./types.js";

/**
 * Build a ready-to-paste prompt that a user can drop into Claude to fix a
 * project's problems. Deterministic (templated from findings) — focuses on the
 * actionable errors + warnings. Returns "" when there's nothing worth fixing.
 */
export function buildFixPrompt(report: HealthReport, name: string): string {
  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const infoCount = report.findings.filter((f) => f.severity === "info").length;
  if (errors.length === 0 && warnings.length === 0) return "";

  const stacks = report.stacks.join(", ") || "JavaScript/Node";
  const lines: string[] = [
    `You are helping me fix issues in my ${stacks} project "${name}".`,
    "",
    "A health check found the problems below. For each one: briefly explain the root " +
      "cause, then give me the exact code or config change that fixes it. Work through " +
      "the errors first, then the warnings. Ask before assuming anything about my setup, " +
      "and don't make changes I didn't ask for.",
    "",
  ];

  const section = (label: string, arr: Finding[]): void => {
    if (arr.length === 0) return;
    lines.push(`## ${label}`);
    for (const f of arr) {
      const loc = f.file ? ` (${f.file})` : "";
      lines.push(`- ${f.title}${loc}`);
      if (f.detail) lines.push(`  ${f.detail}`);
      if (f.recommendation) lines.push(`  Suggested fix: ${f.recommendation}`);
    }
    lines.push("");
  };

  section("Errors", errors);
  section("Warnings", warnings);

  if (infoCount > 0) {
    lines.push(
      `(${infoCount} lower-priority info note${infoCount === 1 ? "" : "s"} were also ` +
        "found — ask if you'd like those addressed too.)",
    );
    lines.push("");
  }

  lines.push("Start with a short, prioritized plan, then implement the fixes one by one.");
  return lines.join("\n");
}
