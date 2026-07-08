import type { Finding, Probe, ProbeContext, Stack } from "../core/types.js";
import { allDeps } from "./shared/util.js";
import { nodeProbes } from "./node/index.js";
import { reactProbes } from "./react/index.js";
import { angularProbes } from "./angular/index.js";

const ALL_PROBES: Probe[] = [...nodeProbes, ...reactProbes, ...angularProbes];

export const KNOWN_STACKS: readonly Stack[] = ["node", "react", "angular"];

/** Infer which stacks a project uses from its dependency graph. */
export function detectStacks(ctx: ProbeContext): Stack[] {
  const stacks = new Set<Stack>();
  const deps = allDeps(ctx.packageJson);
  if (ctx.packageJson) stacks.add("node");
  if (deps["react"] || deps["react-dom"]) stacks.add("react");
  if (deps["@angular/core"]) stacks.add("angular");
  return [...stacks];
}

/** Select the applicable probes for the requested stacks. */
export function probesFor(stacks: Stack[], ctx: ProbeContext): Probe[] {
  const wanted = new Set(stacks);
  return ALL_PROBES.filter((p) => wanted.has(p.stack) && p.appliesTo(ctx));
}

/** Run every selected probe, isolating failures so one bad probe can't abort the run. */
export async function runProbes(probes: Probe[], ctx: ProbeContext): Promise<Finding[]> {
  const results: Finding[] = [];
  for (const probe of probes) {
    try {
      results.push(...(await probe.run(ctx)));
    } catch (err) {
      results.push({
        id: `${probe.id}/probe-error`,
        stack: probe.stack,
        source: "probe",
        severity: "info",
        title: `Probe "${probe.id}" failed to run`,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
