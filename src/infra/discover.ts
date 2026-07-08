import path from "node:path";
import fg from "fast-glob";
import { IGNORED_DIRS } from "../config.js";

const IGNORE_GLOBS = [...IGNORED_DIRS].map((d) => `**/${d}/**`);

/** Default directory depth to walk when discovering projects. */
const DEFAULT_MAX_DEPTH = 6;

/**
 * Discover projects under `root` by locating `package.json` files (skipping
 * node_modules/dist/etc.). Returns the sorted, de-duplicated absolute
 * directories that contain a package.json — each is one project to analyze.
 */
export async function discoverProjects(
  root: string,
  opts?: { maxDepth?: number },
): Promise<string[]> {
  const matches = await fg("**/package.json", {
    cwd: root,
    onlyFiles: true,
    dot: false,
    absolute: true,
    ignore: IGNORE_GLOBS,
    deep: opts?.maxDepth ?? DEFAULT_MAX_DEPTH,
    suppressErrors: true,
  });

  const dirs = new Set<string>();
  for (const match of matches) dirs.add(path.dirname(match));
  return [...dirs].sort();
}
