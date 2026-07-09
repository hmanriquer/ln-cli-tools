import type { Finding, HealthReport, Stack } from "./types.js";

/** Common issues worth a look in any JavaScript/TypeScript codebase. */
const GENERAL_ANTIPATTERNS: readonly string[] = [
  "unused variables, imports, and parameters",
  "dead or unreachable code, and commented-out blocks",
  "`any` types (or missing types) where a precise type would add safety",
  "duplicated logic that should be extracted, and magic numbers/strings",
  "empty catch blocks or swallowed errors",
];

/** Framework-specific anti-patterns, keyed by detected stack. */
const STACK_ANTIPATTERNS: Record<Stack, readonly string[]> = {
  node: [
    "unhandled promise rejections or missing `await` on async calls",
    "blocking synchronous I/O on the request path (e.g. `fs.readFileSync`)",
    "secrets or config hard-coded instead of read from the environment",
    "missing error handling around I/O, network, and JSON parsing",
  ],
  react: [
    "missing/incorrect hook dependency arrays and conditionally-called hooks",
    "missing `key` props on lists (or using the array index as the key)",
    "effects without cleanup, and state updates after unmount",
    "expensive work on every render that should be memoized",
  ],
  angular: [
    "manual subscriptions without unsubscribe (memory leaks) — prefer the async pipe",
    "heavy logic or function calls inside templates instead of the component",
    "components that could use OnPush change detection but don't",
    "services provided in the wrong injector scope",
  ],
};

/** De-duplicated general + per-stack anti-patterns for the detected stacks. */
function antipatternsFor(stacks: Stack[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (item: string): void => {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  };
  GENERAL_ANTIPATTERNS.forEach(add);
  for (const stack of stacks) (STACK_ANTIPATTERNS[stack] ?? []).forEach(add);
  return out;
}

/**
 * Build a ready-to-paste prompt that a user can drop into Claude to fix a
 * project's problems. Deterministic (templated from findings) — focuses on the
 * actionable errors + warnings, then points the assistant at framework-aware
 * anti-patterns and code smells. Returns "" when there's nothing worth fixing.
 */
export function buildFixPrompt(report: HealthReport, name: string): string {
  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const infoCount = report.findings.filter((f) => f.severity === "info").length;
  if (errors.length === 0 && warnings.length === 0) return "";

  const stacks = report.stacks.join(", ") || "JavaScript/Node";
  const lines: string[] = [
    `You are helping me fix issues in my ${stacks} project "${name}".`,
    "",
    "A health check flagged the problems below. Please:",
    "- For each finding, briefly explain the root cause, then give me the exact code or config change that fixes it.",
    "- Work through the errors first, then the warnings.",
    "- While you're in the affected files (and their close neighbours), also watch for the anti-patterns and code smells listed at the end, and fix the ones you're confident about.",
    "- Ask before assuming anything about my setup, and don't make unrelated changes or refactors I didn't ask for.",
    "",
  ];

  const section = (label: string, arr: Finding[]): void => {
    if (arr.length === 0) return;
    lines.push(`## ${label}`);
    for (const f of arr) {
      const loc = f.file ? ` (${f.file})` : "";
      lines.push(`- ${f.title}${loc}`);
      if (f.detail) lines.push(`  ${f.detail}`);
      if (f.recommendation) lines.push(`  Suggested fix: ${f.recommendation}`);
    }
    lines.push("");
  };

  section("Errors", errors);
  section("Warnings", warnings);

  if (infoCount > 0) {
    lines.push(
      `(${infoCount} lower-priority info note${infoCount === 1 ? "" : "s"} were also ` +
        "found — ask if you'd like those addressed too.)",
    );
    lines.push("");
  }

  const antipatterns = antipatternsFor(report.stacks);
  lines.push("## Also watch for (beyond the findings above)");
  lines.push(
    "As you touch the code, keep an eye out for these common issues and fix the ones you're confident about — don't invent problems or refactor unrelated code:",
  );
  for (const item of antipatterns) lines.push(`- ${item}`);
  lines.push("");

  lines.push("Start with a short, prioritized plan, then implement the fixes one by one.");
  return lines.join("\n");
}
