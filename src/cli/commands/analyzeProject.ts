import { resolveEffort } from "../../config.js";
import { buildReport } from "../../core/report.js";
import type { Finding, HealthReport, ProbeContext, Stack } from "../../core/types.js";
import { createFileAccess, readPackageJson } from "../../infra/fs.js";
import { detectStacks, probesFor, runProbes } from "../../probes/registry.js";
import { analyzeWith, providerConfigured, providerLabel, resolveProviderId } from "../../ai/providers.js";

export interface AnalyzeProjectOptions {
  /** Absolute, already-resolved-and-validated project directory. */
  root: string;
  ai: boolean;
  provider?: string;
  model?: string;
  effort?: string;
  /** Explicit stacks (from --*-health). Take priority over `stack`. */
  stacks?: Stack[];
  /** Single stack or "auto" (positional/interactive). Ignored if `stacks` is given. */
  stack?: Stack | "auto";
  /** Progress lines from the AI layer (e.g. tool calls). */
  onActivity?: (line: string) => void;
}

/**
 * Analyze a single project and return its HealthReport. UI-free: no spinners,
 * no rendering, no exit code — callers own progress and output. Shared by the
 * `check` (single) and `scan` (multi-project) commands.
 */
export async function analyzeProject(opts: AnalyzeProjectOptions): Promise<HealthReport> {
  const { root } = opts;
  const files = createFileAccess(root);
  const packageJson = readPackageJson(files);
  const ctx: ProbeContext = { root, packageJson, files };

  // Stack selection precedence: explicit --*-health → positional/interactive → auto-detect.
  const explicit = opts.stacks && opts.stacks.length > 0 ? [...new Set(opts.stacks)] : null;
  const selected = opts.stack ?? "auto";
  const stacks: Stack[] = explicit ?? (selected === "auto" ? detectStacks(ctx) : [selected]);

  // If a stack was explicitly requested but not present, surface an info notice.
  const requestedNotices: Finding[] = [];
  if (explicit) {
    const detected = new Set(detectStacks(ctx));
    for (const s of explicit) {
      if (!detected.has(s)) {
        requestedNotices.push({
          id: `${s}/not-detected`,
          stack: s,
          source: "probe",
          severity: "info",
          title: `${s} checks requested, but no ${s} project markers were found`,
          detail: `--${s}-health was passed, yet this project doesn't look like a ${s} project (no matching dependencies or config). No ${s}-specific findings to report.`,
        });
      }
    }
  }

  // Deterministic probes: the always-on backbone.
  const probes = probesFor(stacks, ctx);
  const probeFindings = [...requestedNotices, ...(await runProbes(probes, ctx))];

  // AI layer: read-only, advisory, never blocks the baseline result.
  let aiFindings: Finding[] = [];
  let narrative: string | undefined;
  let skipped: string | undefined;

  const wantAi = opts.ai;
  const providerId = wantAi ? resolveProviderId(opts.provider) : null;
  if (!wantAi) {
    skipped = "disabled with --no-ai";
  } else if (!providerId) {
    skipped = "no AI provider configured";
  } else if (!providerConfigured(providerId)) {
    skipped = `${providerLabel(providerId)} selected but not configured`;
  } else {
    try {
      const result = await analyzeWith(providerId, {
        root,
        model: opts.model,
        effort: resolveEffort(opts.effort),
        stacks,
        probeFindings,
        rootEntries: files.listRoot(),
        onActivity: opts.onActivity,
      });
      aiFindings = result.findings;
      narrative = result.narrative;
    } catch (err) {
      skipped = `AI analysis failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const findings = [...probeFindings, ...aiFindings];
  return buildReport(root, stacks, findings, { narrative, skipped });
}
