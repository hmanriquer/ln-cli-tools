/**
 * Domain types. This module is pure: it must NOT import from infra/, ai/, or cli/.
 * Everything the rest of the app agrees on is defined here.
 */

export type Severity = "info" | "warning" | "error";

export type Stack = "node" | "react" | "angular";

export type FindingSource = "probe" | "ai";

/** A single health-check observation. */
export interface Finding {
  /** Stable-ish identifier, e.g. "node/missing-lockfile". */
  id: string;
  title: string;
  /** Human explanation of what was observed and why it matters. */
  detail: string;
  severity: Severity;
  source: FindingSource;
  stack?: Stack;
  /** Project-relative file the finding refers to, when applicable. */
  file?: string;
  /** Suggested action. The tool never applies it — the user decides. */
  recommendation?: string;
}

/** Minimal, typed view of a package.json. */
export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  type?: "module" | "commonjs";
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  license?: string;
  [key: string]: unknown;
}

/** Read-only access to the target project. Implemented by infra/. */
export interface FileAccess {
  exists(relativePath: string): boolean;
  read(relativePath: string): string | null;
  /** Top-level entries relative to root (files + dirs, ignored dirs filtered). */
  listRoot(): string[];
}

/** Everything a probe needs to inspect a project. */
export interface ProbeContext {
  /** Absolute path to the project root. */
  root: string;
  packageJson: PackageJson | null;
  files: FileAccess;
}

/** A deterministic collector for one ecosystem. */
export interface Probe {
  id: string;
  stack: Stack;
  /** Cheap gate: is this probe relevant to the given project? */
  appliesTo(ctx: ProbeContext): boolean;
  run(ctx: ProbeContext): Finding[] | Promise<Finding[]>;
}

export interface HealthReport {
  root: string;
  stacks: Stack[];
  findings: Finding[];
  ai?: {
    narrative?: string;
    skipped?: string;
  };
  generatedAt: string;
}
