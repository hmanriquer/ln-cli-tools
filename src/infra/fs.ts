import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { IGNORED_DIRS } from "../config.js";
import type { FileAccess, PackageJson } from "../core/types.js";

/**
 * Resolve a project-relative path and guarantee it stays inside `root`.
 * Rejects traversal (`..`), absolute escapes, and symlink escapes.
 * Every file access in the app funnels through here.
 */
export function resolveWithin(root: string, relativePath: string): string {
  const abs = path.resolve(root, relativePath);
  const rel = path.relative(root, abs);
  if (rel === "" ) return abs; // the root itself
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes project root: ${relativePath}`);
  }
  return abs;
}

/** Read-only, sandboxed file access for probes and the AI layer. */
export function createFileAccess(root: string): FileAccess {
  return {
    exists(relativePath: string): boolean {
      try {
        return existsSync(resolveWithin(root, relativePath));
      } catch {
        return false;
      }
    },
    read(relativePath: string): string | null {
      try {
        const abs = resolveWithin(root, relativePath);
        if (!existsSync(abs) || !statSync(abs).isFile()) return null;
        return readFileSync(abs, "utf8");
      } catch {
        return null;
      }
    },
    listRoot(): string[] {
      try {
        return readdirSync(root, { withFileTypes: true })
          .filter((e) => !(e.isDirectory() && IGNORED_DIRS.has(e.name)))
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort();
      } catch {
        return [];
      }
    },
  };
}

/** Parse the project's package.json, or null if absent/invalid. */
export function readPackageJson(files: FileAccess): PackageJson | null {
  const raw = files.read("package.json");
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}
