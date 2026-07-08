import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { computeExitCode, summarize } from "../../core/report.js";
import type { HealthReport, Severity } from "../../core/types.js";
import { discoverProjects } from "../../infra/discover.js";
import { emitHtmlReport } from "../html.js";
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
    const verdict = c.error ? pc.red("✖") : c.warning ? pc.yellow("⚠") : pc.green("✓");
    console.log(`  ${verdict} ${name} ${stacks}  ${parts.join(pc.dim(" · ")) || pc.green("clean")}`);
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
    SEV_COLOR.warning(`${totals.warning} warning${totals.warning === 1 ? "" : "s"}`),
    SEV_COLOR.info(`${totals.info} info`),
  ].join(pc.dim(" · "));
  console.log("");
  console.log(pc.bold(`${reports.length} projects · ${totalLine}`));
  console.log("");
}

export async function runScan(opts: ScanOptions): Promise<number> {
  const scanRoot = resolveRoot(opts.args[0] ?? ".");

  const discoverSpinner = opts.interactive ? p.spinner() : null;
  discoverSpinner?.start("Discovering projects…");
  const projectDirs = (await discoverProjects(scanRoot, { maxDepth: opts.depth })).map((d) =>
    path.resolve(d),
  );
  discoverSpinner?.stop(`Found ${projectDirs.length} project${projectDirs.length === 1 ? "" : "s"}.`);

  if (projectDirs.length === 0) {
    console.error(pc.yellow(`No projects (package.json) found under ${scanRoot}.`));
    return 0;
  }

  const reports: HealthReport[] = [];
  for (let i = 0; i < projectDirs.length; i += 1) {
    const dir = projectDirs[i] as string;
    const name = path.relative(scanRoot, dir) || path.basename(dir);
    const label = `[${i + 1}/${projectDirs.length}] ${name}`;

    const spinner = opts.interactive ? p.spinner() : null;
    spinner?.start(`${label} — analyzing…`);
    if (!opts.interactive && !opts.json) console.error(pc.dim(`  ${label}…`));

    const report = await analyzeProject({
      root: dir,
      ai: opts.ai,
      provider: opts.provider,
      model: opts.model,
      effort: opts.effort,
      stack: "auto",
      onActivity: (line) => spinner?.message(`${label} · ${pc.dim(line)}`),
    });
    reports.push(report);

    const c = counts(report);
    spinner?.stop(`${label} — ${c.error} err · ${c.warning} warn · ${c.info} info`);
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
  } else {
    renderScanSummary(scanRoot, reports);
  }

  const outPath = opts.out ?? path.join(scanRoot, "crystal-pulse-report.html");
  emitHtmlReport(reports, { outPath, open: opts.open !== false, scanRoot });

  return computeExitCode(allFindings);
}
