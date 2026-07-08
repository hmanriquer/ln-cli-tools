/**
 * Static configuration and defaults. No runtime state lives here.
 */

/** Default Claude model for the AI analysis layer. */
export const DEFAULT_MODEL = "claude-opus-4-8";

/** Default reasoning effort for the analysis loop. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const DEFAULT_EFFORT: Effort = "high";

/** Per-turn output cap for the streaming analysis loop. */
export const MAX_TOKENS = 16_000;

/** Hard cap on agentic tool-use iterations, so a run always terminates. */
export const MAX_AI_ITERATIONS = 14;

/** Largest single file the AI read tool will return (bytes). */
export const MAX_READ_BYTES = 64 * 1024;

/** Directories never walked by probes or the AI file tools. */
export const IGNORED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".angular",
  "coverage",
  ".turbo",
  ".cache",
  ".vercel",
]);

/** Resolve model/effort from env with fallback to defaults. */
export function resolveModel(override?: string): string {
  return override ?? process.env.HC_MODEL ?? DEFAULT_MODEL;
}

export function resolveEffort(override?: string): Effort {
  const value = (override ?? process.env.HC_EFFORT ?? DEFAULT_EFFORT) as Effort;
  const allowed: Effort[] = ["low", "medium", "high", "xhigh", "max"];
  return allowed.includes(value) ? value : DEFAULT_EFFORT;
}
