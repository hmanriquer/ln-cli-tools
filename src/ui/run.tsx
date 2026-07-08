import { render } from "ink";
import type { HealthReport } from "../core/types.js";
import { RunApp, type RunHooks, type RunMeta } from "./apps/RunApp.js";
import { ScanApp } from "./apps/ScanApp.js";

/**
 * Mount the live run panel, drive `execute`, and resolve with the report once
 * the analysis finishes and the final frame has been painted. TTY-only — the
 * caller must fall back to plain rendering for non-interactive/JSON runs.
 */
export async function runWithTui(
  meta: RunMeta,
  execute: (hooks: RunHooks) => Promise<HealthReport>,
): Promise<HealthReport> {
  let captured: HealthReport | null = null;
  const { waitUntilExit } = render(
    <RunApp
      meta={meta}
      execute={execute}
      onDone={(report) => {
        captured = report;
      }}
    />,
  );
  await waitUntilExit();
  if (!captured) throw new Error("Run panel exited before producing a report.");
  return captured;
}

/**
 * Mount the multi-project scan panel and resolve with all reports once every
 * project has been analyzed. TTY-only — callers fall back to plain rendering.
 */
export async function scanWithTui(
  projects: string[],
  meta: RunMeta,
  runOne: (index: number, hooks: RunHooks) => Promise<HealthReport>,
): Promise<HealthReport[]> {
  let captured: HealthReport[] | null = null;
  const { waitUntilExit } = render(
    <ScanApp
      projects={projects}
      meta={meta}
      runOne={runOne}
      onDone={(reports) => {
        captured = reports;
      }}
    />,
  );
  await waitUntilExit();
  if (!captured) throw new Error("Scan panel exited before producing reports.");
  return captured;
}
