import path from "node:path";
import pc from "picocolors";
import { resolveEffort, resolveModel } from "../../config.js";
import { computeExitCode, summarize } from "../../core/report.js";
import type { HealthReport, Severity } from "../../core/types.js";
import { discoverProjects } from "../../infra/discover.js";
import { emitHtmlReport } from "../html.js";
import { scanWithTui } from "../../ui/run.js";
import type { RunHooks } from "../../ui/apps/RunApp.js";
import { analyzeProject } from "./analyzeProject.js";
import { resolveRoot } from "./check.js";

export interface ScanOptions {
  /** Positional arg: [path] to scan (defaults to "."). */
  args: string[];
  json: boolean;
  ai: boolean;
  interactive: boolean;
  provider?: string;
  model?: string;
  effort?: string;
  out?: string;
  open?: boolean;
  depth?: number;
}

const SEV_COLOR: Record<Severity, (s: string) => string> = {
  error: pc.red,
  warning: pc.yellow,
  info: pc.cyan,
};

function counts(report: HealthReport) {
  return summarize(report.findings);
}

/** Compact terminal summary — one line per project plus overall totals. */
function renderScanSummary(scanRoot: string, reports: HealthReport[]): void {
  console.log("");
  for (const r of reports) {
    const c = counts(r);
    const name = path.relative(scanRoot, r.root) || path.basename(r.root);
    const stacks = pc.dim(`(${r.stacks.join(", ") || "unknown"})`);
    const parts = [
      c.error ? pc.red(`${c.error} err`) : "",
      c.warning ? pc.yellow(`${c.warning} warn`) : "",
      c.info ? pc.cyan(`${c.info} info`) : "",
    ].filter(Boolean);
    const verdict = c.error
      ? pc.red("✖")
      : c.warning
        ? pc.yellow("⚠")
        : pc.green("✓");
    console.log(
      `  ${verdict} ${name} ${stacks}  ${parts.join(pc.dim(" · ")) || pc.green("clean")}`,
    );
  }

  const totals = reports.reduce(
    (acc, r) => {
      const c = counts(r);
      acc.error += c.error;
      acc.warning += c.warning;
      acc.info += c.info;
      return acc;
    },
    { error: 0, warning: 0, info: 0 } as Record<Severity, number>,
  );
  const totalLine = [
    SEV_COLOR.error(`${totals.error} error${totals.error === 1 ? "" : "s"}`),
    SEV_COLOR.warning(
      `${totals.warning} warning${totals.warning === 1 ? "" : "s"}`,
    ),
    SEV_COLOR.info(`${totals.info} info`),
  ].join(pc.dim(" · "));
  console.log("");
  console.log(pc.bold(`${reports.length} projects · ${totalLine}`));
  console.log("");
}

export async function runScan(opts: ScanOptions): Promise<number> {
  const scanRoot = resolveRoot(opts.args[0] ?? ".");
  const useTui = opts.interactive && !opts.json;

  if (useTui || (!opts.json && !opts.interactive)) {
    console.error(pc.dim("  discovering projects…"));
  }
  const projectDirs = (
    await discoverProjects(scanRoot, { maxDepth: opts.depth })
  ).map((d) => path.resolve(d));

  if (projectDirs.length === 0) {
    console.error(
      pc.yellow(`No projects (package.json) found under ${scanRoot}.`),
    );
    return 0;
  }

  const names = projectDirs.map(
    (dir) => path.relative(scanRoot, dir) || path.basename(dir),
  );

  const runOne = (index: number, hooks: RunHooks): Promise<HealthReport> =>
    analyzeProject({
      root: projectDirs[index] as string,
      ai: opts.ai,
      provider: opts.provider,
      model: opts.model,
      effort: opts.effort,
      stack: "auto",
      onActivity: hooks.onActivity,
      onPhase: hooks.onPhase,
    });

  let reports: HealthReport[];

  if (useTui) {
    reports = await scanWithTui(
      names,
      {
        provider: opts.ai ? (opts.provider ?? "auto") : "probes only",
        model: opts.ai ? (opts.model ?? resolveModel()) : undefined,
        effort: opts.ai ? (opts.effort ?? resolveEffort()) : undefined,
      },
      runOne,
    );
  } else {
    reports = [];
    for (let i = 0; i < projectDirs.length; i += 1) {
      const label = `[${i + 1}/${projectDirs.length}] ${names[i]}`;
      if (!opts.json) console.error(pc.dim(`  ${label}…`));
      reports.push(
        await runOne(i, {
          onPhase: () => {},
          onActivity: (line) => {
            if (!opts.json) console.error(pc.dim(`    → ${line}`));
          },
        }),
      );
    }
  }

  const allFindings = reports.flatMap((r) => r.findings);

  if (opts.json) {
    console.log(
      JSON.stringify(
        { scanRoot, generatedAt: new Date().toISOString(), projects: reports },
        null,
        2,
      ),
    );
  } else if (!useTui) {
    renderScanSummary(scanRoot, reports);
  }

  const outPath = opts.out ?? path.join(scanRoot, "crystal-pulse-report.html");
  emitHtmlReport(reports, { outPath, open: opts.open !== false, scanRoot });

  return computeExitCode(allFindings);
}
