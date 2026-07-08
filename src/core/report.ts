import type { Finding, HealthReport, Severity, Stack } from "./types.js";

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/**
 * Exit code policy: only deterministic probe *errors* fail the run.
 * AI findings are advisory and never change the exit code.
 */
export function computeExitCode(findings: Finding[]): number {
  const hasProbeError = findings.some(
    (f) => f.source === "probe" && f.severity === "error",
  );
  return hasProbeError ? 1 : 0;
}

export function summarize(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

export function buildReport(
  root: string,
  stacks: Stack[],
  findings: Finding[],
  ai?: HealthReport["ai"],
): HealthReport {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return {
    root,
    stacks,
    findings: sorted,
    ai,
    generatedAt: new Date().toISOString(),
  };
}
