import { render } from "ink";
import type { HealthReport } from "../core/types.js";
import { RunApp, type RunHooks, type RunMeta } from "./apps/RunApp.js";

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
