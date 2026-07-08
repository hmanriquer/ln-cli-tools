import type Anthropic from "@anthropic-ai/sdk";
import fg from "fast-glob";
import { IGNORED_DIRS, MAX_READ_BYTES } from "../config.js";
import { createFileAccess, resolveWithin } from "../infra/fs.js";

const IGNORE_GLOBS = [...IGNORED_DIRS].map((d) => `**/${d}/**`);

/**
 * Read-only investigation tools handed to Claude. There are deliberately NO
 * write, edit, or shell tools: the analysis observes and recommends, it never
 * mutates the target project. `submit_findings` terminates the loop.
 */
export const analysisTools: Anthropic.Tool[] = [
  {
    name: "list_dir",
    description:
      "List the entries of a directory in the project (relative path, e.g. '.' or 'src'). Ignored build/vendor dirs are hidden.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Project-relative directory path." } },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read a UTF-8 text file in the project by relative path. Large files are truncated.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Project-relative file path." } },
      required: ["path"],
    },
  },
  {
    name: "glob",
    description:
      "Find files matching a glob pattern (e.g. 'src/**/*.tsx'). Returns up to 200 relative paths.",
    input_schema: {
      type: "object",
      properties: { pattern: { type: "string", description: "A glob pattern, project-relative." } },
      required: ["pattern"],
    },
  },
  {
    name: "grep",
    description:
      "Search file contents with a JavaScript regular expression. Optionally restrict to a glob. Returns up to 100 matching lines as 'path:line: text'.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "A JavaScript regular expression." },
        glob: { type: "string", description: "Optional glob to limit which files are searched." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "submit_findings",
    description:
      "Call exactly once, at the end, to submit your analysis. After calling it, stop — do not call other tools.",
    input_schema: {
      type: "object",
      properties: {
        narrative: { type: "string", description: "A concise (2-5 sentence) overall assessment." },
        findings: {
          type: "array",
          description: "Concrete issues you found, most severe first.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string", description: "What you observed and why it matters." },
              severity: { type: "string", enum: ["info", "warning", "error"] },
              file: { type: "string", description: "Project-relative file, if applicable." },
              recommendation: { type: "string", description: "Suggested action (the user decides whether to apply it)." },
            },
            required: ["title", "detail", "severity"],
          },
        },
      },
      required: ["narrative", "findings"],
    },
  },
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Execute one read-only tool call and return its textual result. */
export async function executeTool(
  root: string,
  name: string,
  input: unknown,
): Promise<string> {
  const args = (input ?? {}) as Record<string, unknown>;
  const files = createFileAccess(root);

  switch (name) {
    case "list_dir": {
      const rel = asString(args["path"]) || ".";
      try {
        resolveWithin(root, rel);
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
      const entries = await fg("*", {
        cwd: resolveWithin(root, rel),
        onlyFiles: false,
        markDirectories: true,
        dot: false,
        deep: 1,
        ignore: [...IGNORED_DIRS],
      });
      return entries.length ? entries.sort().join("\n") : "(empty or not a directory)";
    }

    case "read_file": {
      const rel = asString(args["path"]);
      const content = files.read(rel);
      if (content === null) return `Error: cannot read file: ${rel}`;
      if (content.length > MAX_READ_BYTES) {
        return `${content.slice(0, MAX_READ_BYTES)}\n\n[...truncated at ${MAX_READ_BYTES} bytes...]`;
      }
      return content;
    }

    case "glob": {
      const pattern = asString(args["pattern"]);
      if (!pattern) return "Error: pattern is required";
      const matches = await fg(pattern, {
        cwd: root,
        onlyFiles: true,
        dot: false,
        ignore: IGNORE_GLOBS,
      });
      if (matches.length === 0) return "(no matches)";
      const capped = matches.slice(0, 200);
      const suffix = matches.length > 200 ? `\n[...${matches.length - 200} more]` : "";
      return capped.join("\n") + suffix;
    }

    case "grep": {
      const pattern = asString(args["pattern"]);
      if (!pattern) return "Error: pattern is required";
      let re: RegExp;
      try {
        re = new RegExp(pattern);
      } catch (err) {
        return `Error: invalid regular expression: ${(err as Error).message}`;
      }
      const glob = asString(args["glob"]) || "**/*.{js,jsx,ts,tsx,mjs,cjs,json,html,css,scss}";
      const targets = await fg(glob, {
        cwd: root,
        onlyFiles: true,
        dot: false,
        ignore: IGNORE_GLOBS,
      });
      const results: string[] = [];
      for (const rel of targets.slice(0, 500)) {
        const content = files.read(rel);
        if (content === null) continue;
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i] ?? "";
          if (re.test(line)) {
            results.push(`${rel}:${i + 1}: ${line.trim().slice(0, 200)}`);
            if (results.length >= 100) break;
          }
        }
        if (results.length >= 100) break;
      }
      return results.length ? results.join("\n") : "(no matches)";
    }

    default:
      return `Error: unknown tool "${name}"`;
  }
}
