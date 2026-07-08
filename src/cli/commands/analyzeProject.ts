import { resolveEffort } from "../../config.js";
import { buildReport } from "../../core/report.js";
import type {
  Finding,
  HealthReport,
  ProbeContext,
  Stack,
} from "../../core/types.js";
import { createFileAccess, readPackageJson } from "../../infra/fs.js";
import { detectStacks, probesFor, runProbes } from "../../probes/registry.js";
import {
  analyzeWith,
  providerConfigured,
  providerLabel,
  resolveProviderId,
} from "../../ai/providers.js";

/** Coarse stages of a single-project analysis, surfaced to the live UI. */
export type RunPhase = "detect" | "probes" | "ai" | "report";

export interface PhaseEvent {
  phase: RunPhase;
  status: "start" | "done" | "skipped";
  /** Short context, e.g. detected stacks or a skip reason. */
  note?: string;
}

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
  /** Coarse phase transitions for the live UI. */
  onPhase?: (event: PhaseEvent) => void;
}

/**
 * Analyze a single project and return its HealthReport. UI-free: no spinners,
 * no rendering, no exit code — callers own progress and output. Shared by the
 * `check` (single) and `scan` (multi-project) commands.
 */
export async function analyzeProject(
  opts: AnalyzeProjectOptions,
): Promise<HealthReport> {
  const { root } = opts;
  const onPhase = opts.onPhase ?? (() => {});
  const files = createFileAccess(root);
  const packageJson = readPackageJson(files);
  const ctx: ProbeContext = { root, packageJson, files };

  // Stack selection precedence: explicit --*-health → positional/interactive → auto-detect.
  onPhase({ phase: "detect", status: "start" });
  const explicit =
    opts.stacks && opts.stacks.length > 0 ? [...new Set(opts.stacks)] : null;
  const selected = opts.stack ?? "auto";
  const stacks: Stack[] =
    explicit ?? (selected === "auto" ? detectStacks(ctx) : [selected]);
  onPhase({
    phase: "detect",
    status: "done",
    note: stacks.join(", ") || "unknown",
  });

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
  onPhase({ phase: "probes", status: "start" });
  const probes = probesFor(stacks, ctx);
  const probeFindings = [
    ...requestedNotices,
    ...(await runProbes(probes, ctx)),
  ];
  onPhase({
    phase: "probes",
    status: "done",
    note: `${probeFindings.length} finding${probeFindings.length === 1 ? "" : "s"}`,
  });

  // AI layer: read-only, advisory, never blocks the baseline result.
  let aiFindings: Finding[] = [];
  let narrative: string | undefined;
  let skipped: string | undefined;

  const wantAi = opts.ai;
  const providerId = wantAi ? resolveProviderId(opts.provider) : null;
  if (!wantAi) {
    skipped = "disabled with --no-ai";
    onPhase({ phase: "ai", status: "skipped", note: skipped });
  } else if (!providerId) {
    skipped = "no AI provider configured";
    onPhase({ phase: "ai", status: "skipped", note: skipped });
  } else if (!providerConfigured(providerId)) {
    skipped = `${providerLabel(providerId)} selected but not configured`;
    onPhase({ phase: "ai", status: "skipped", note: skipped });
  } else {
    onPhase({ phase: "ai", status: "start", note: providerLabel(providerId) });
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
      onPhase({
        phase: "ai",
        status: "done",
        note: `${aiFindings.length} finding${aiFindings.length === 1 ? "" : "s"}`,
      });
    } catch (err) {
      skipped = `AI analysis failed: ${err instanceof Error ? err.message : String(err)}`;
      onPhase({ phase: "ai", status: "skipped", note: skipped });
    }
  }

  onPhase({ phase: "report", status: "start" });
  const findings = [...probeFindings, ...aiFindings];
  const report = buildReport(root, stacks, findings, { narrative, skipped });
  onPhase({ phase: "report", status: "done" });
  return report;
}
