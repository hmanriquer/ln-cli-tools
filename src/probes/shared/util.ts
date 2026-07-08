import type { Finding, PackageJson, ProbeContext, Severity, Stack } from "../../core/types.js";

/** Merge dependencies + devDependencies + peerDependencies into one map. */
export function allDeps(pkg: PackageJson | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
}

export function hasDep(ctx: ProbeContext, name: string): boolean {
  return name in allDeps(ctx.packageJson);
}

export function depRange(ctx: ProbeContext, name: string): string | undefined {
  return allDeps(ctx.packageJson)[name];
}

/**
 * Best-effort major version from a semver range like "^18.2.0", "~4.3", ">=5".
 * Returns null when it can't be determined (e.g. "latest", git URL, workspace:*).
 */
export function majorFromRange(range: string | undefined): number | null {
  if (!range) return null;
  const match = range.match(/(\d+)\./) ?? range.match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Small factory to keep probe code terse and finding ids consistent. */
export function finding(
  stack: Stack,
  id: string,
  severity: Severity,
  title: string,
  detail: string,
  extra?: { file?: string; recommendation?: string },
): Finding {
  return {
    id: `${stack}/${id}`,
    stack,
    source: "probe",
    severity,
    title,
    detail,
    ...(extra?.file ? { file: extra.file } : {}),
    ...(extra?.recommendation ? { recommendation: extra.recommendation } : {}),
  };
}
