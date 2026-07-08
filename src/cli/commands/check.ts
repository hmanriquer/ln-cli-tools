import { existsSync, statSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { resolveEffort, resolveModel } from "../../config.js";
import { computeExitCode } from "../../core/report.js";
import type { HealthReport, Stack } from "../../core/types.js";
import { KNOWN_STACKS } from "../../probes/registry.js";
import { renderJson, renderReport } from "../render.js";
import { emitHtmlReport } from "../html.js";
import { runWithTui } from "../../ui/run.js";
import { analyzeProject, type PhaseEvent } from "./analyzeProject.js";

export interface CheckOptions {
  /** Positional args as given (0–2): may be [stack], [path], or [stack, path]. */
  args: string[];
  json: boolean;
  ai: boolean;
  /** TTY, non-JSON run: enables spinners and richer output. */
  interactive: boolean;
  model?: string;
  effort?: string;
  /** AI provider: "auto" | "anthropic" | "github-models" | "gemini". */
  provider?: string;
  /** Pre-resolved values (from the interactive flow). Take priority over args. */
  stack?: Stack | "auto";
  path?: string;
  /** Explicit stack selection from --react-health / --angular-health / --node-health. */
  stacks?: Stack[];
  /** Also write + open a self-contained HTML report. */
  html?: boolean;
  /** Output path for the HTML report (defaults to <root>/crystal-pulse-report.html). */
  out?: string;
  /** Open the HTML report in the browser (default true; --no-open sets false). */
  open?: boolean;
}

function isStack(value: string): value is Stack {
  return (KNOWN_STACKS as readonly string[]).includes(value);
}

/** Turn loose positionals (`react ./app`, `./app`, `node`, ``) into a stack + path. */
function resolveArgs(opts: CheckOptions): {
  stack: Stack | "auto";
  path: string;
} {
  if (opts.stack || opts.path) {
    return { stack: opts.stack ?? "auto", path: opts.path ?? "." };
  }
  const [a, b] = opts.args;
  if (a && b) return { stack: isStack(a) ? a : "auto", path: b };
  if (a)
    return isStack(a) ? { stack: a, path: "." } : { stack: "auto", path: a };
  return { stack: "auto", path: "." };
}

export function resolveRoot(rawPath: string): string {
  const root = path.resolve(process.cwd(), rawPath);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  return root;
}

export async function runCheck(opts: CheckOptions): Promise<number> {
  const { stack, path: rawPath } = resolveArgs(opts);
  const root = resolveRoot(rawPath);

  const execute = (hooks: {
    onPhase: (event: PhaseEvent) => void;
    onActivity: (line: string) => void;
  }): Promise<HealthReport> =>
    analyzeProject({
      root,
      ai: opts.ai,
      provider: opts.provider,
      model: opts.model,
      effort: opts.effort,
      stacks: opts.stacks,
      stack,
      onActivity: hooks.onActivity,
      onPhase: hooks.onPhase,
    });

  let report: HealthReport;

  if (opts.interactive && !opts.json) {
    // Live TUI panel drives the run and renders the report on completion.
    report = await runWithTui(
      {
        provider: opts.ai ? (opts.provider ?? "auto") : "probes only",
        model: opts.ai ? (opts.model ?? resolveModel()) : undefined,
        effort: opts.ai ? (opts.effort ?? resolveEffort()) : undefined,
      },
      execute,
    );
  } else {
    if (!opts.json && opts.ai) console.error(pc.dim("  analyzing…"));
    report = await execute({
      onPhase: () => {},
      onActivity: (line) => {
        if (!opts.json) console.error(pc.dim(`    → ${line}`));
      },
    });
    if (opts.json) renderJson(report);
    else renderReport(report);
  }

  if (opts.html) {
    const outPath = opts.out ?? path.join(root, "crystal-pulse-report.html");
    emitHtmlReport([report], { outPath, open: opts.open !== false });
  }

  return computeExitCode(report.findings);
}
