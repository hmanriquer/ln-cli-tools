import pc from "picocolors";
import type { Finding, HealthReport, Severity } from "../core/types.js";
import { summarize } from "../core/report.js";
import { cleanNarrative } from "../core/narrative.js";
import { APP_NAME, AUTHOR, SHORT_TAGLINE } from "./brand.js";

type Colorize = (text: string) => string;

const SYMBOL: Record<Severity, string> = {
  error: "✖",
  warning: "⚠",
  info: "•",
};
const SEV_COLOR: Record<Severity, Colorize> = {
  error: pc.red,
  warning: pc.yellow,
  info: pc.cyan,
};
const SEV_LABEL: Record<Severity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

/** Visible width, ignoring ANSI color escapes. */
function visibleLength(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Draw a rounded box around the given (already-colored) lines. */
function box(lines: string[], border: Colorize = pc.dim): string[] {
  const width = Math.max(0, ...lines.map(visibleLength));
  const bar = (chars: string) => border(chars);
  const out = [bar(`╭${"─".repeat(width + 2)}╮`)];
  for (const line of lines) {
    const pad = " ".repeat(width - visibleLength(line));
    out.push(`${bar("│")} ${line}${pad} ${bar("│")}`);
  }
  out.push(bar(`╰${"─".repeat(width + 2)}╯`));
  return out;
}

/** Boxed title banner. Printed once at the top of a run (never in --json). */
export function renderBanner(): void {
  const tagline = pc.dim(`· ${SHORT_TAGLINE}`);
  const author = pc.bold(pc.magenta(AUTHOR));
  const title = `${pc.cyan("✦")} ${pc.bold(pc.cyan(APP_NAME))}  ${author}  ${tagline}`;
  console.log("");
  for (const line of box([title], pc.cyan)) console.log(line);
}

/**
 * Prominent, top-of-screen heads-up shown when no API key is detected.
 * `hint` overrides the default (CLI) call-to-action — e.g. for the --ui menu.
 */
export function renderNoKeyWarning(hint?: string): void {
  const detail =
    hint ??
    "Set ANTHROPIC_API_KEY, run `ant auth login` for OAuth, or pass --no-ai to skip AI.";
  const lines = [
    `${pc.yellow("⚠")}  ${pc.bold(pc.yellow("No Anthropic credentials detected"))}${pc.dim(" — AI analysis is disabled.")}`,
    pc.dim(detail),
  ];
  console.log("");
  for (const line of box(lines, pc.yellow)) console.log(line);
}

function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  const groups: Record<Severity, Finding[]> = {
    error: [],
    warning: [],
    info: [],
  };
  for (const f of findings) groups[f.severity].push(f);
  return groups;
}

function renderFinding(f: Finding): string[] {
  const color = SEV_COLOR[f.severity];
  const tag = pc.dim(f.source === "ai" ? "[AI]" : "[probe]");
  const lines = [`  ${color(SYMBOL[f.severity])} ${color(f.title)} ${tag}`];
  if (f.file) lines.push(pc.dim(`      ${f.file}`));
  if (f.detail) lines.push(pc.dim("      ") + f.detail);
  if (f.recommendation)
    lines.push(`      ${pc.green("→")} ${pc.green(f.recommendation)}`);
  return lines;
}

function renderSection(severity: Severity, items: Finding[]): void {
  if (items.length === 0) return;
  const color = SEV_COLOR[severity];
  console.log(pc.bold(color(`${SEV_LABEL[severity]} (${items.length})`)));
  for (const f of items) {
    for (const line of renderFinding(f)) console.log(line);
    console.log("");
  }
}

/** Human-readable report. */
export function renderReport(report: HealthReport): void {
  const { findings } = report;
  const counts = summarize(findings);

  console.log("");
  console.log(`${pc.dim("target:")} ${report.root}`);
  console.log(
    `${pc.dim("stacks:")} ${report.stacks.join(", ") || pc.dim("unknown")}`,
  );
  console.log("");

  if (findings.length === 0) {
    console.log(pc.green("  ✓ No findings — looks healthy. 🎉"));
    console.log("");
  } else {
    const groups = groupBySeverity(findings);
    renderSection("error", groups.error);
    renderSection("warning", groups.warning);
    renderSection("info", groups.info);
  }

  const narrative = report.ai?.narrative
    ? cleanNarrative(report.ai.narrative)
    : "";
  if (narrative) {
    console.log(pc.bold(pc.cyan("AI summary")));
    console.log(pc.dim("  ") + narrative.replaceAll("\n", "\n  "));
    console.log("");
  } else if (report.ai?.skipped) {
    console.log(pc.dim(`AI analysis skipped: ${report.ai.skipped}`));
    console.log("");
  }

  renderSummaryBox(counts);
}

function renderSummaryBox(counts: Record<Severity, number>): void {
  const parts = [
    counts.error
      ? pc.red(`${counts.error} error${counts.error > 1 ? "s" : ""}`)
      : "",
    counts.warning
      ? pc.yellow(`${counts.warning} warning${counts.warning > 1 ? "s" : ""}`)
      : "",
    counts.info ? pc.cyan(`${counts.info} info`) : "",
  ].filter(Boolean);

  let verdict: string;
  let border: Colorize;
  if (counts.error > 0) {
    verdict = pc.red("✖ action needed — probe errors present");
    border = pc.red;
  } else if (counts.warning > 0) {
    verdict = pc.yellow("⚠ review recommended");
    border = pc.yellow;
  } else {
    verdict = pc.green("✓ looks healthy");
    border = pc.green;
  }

  const summaryLine = parts.length
    ? parts.join(pc.dim(" · "))
    : pc.green("clean");
  for (const line of box([summaryLine, verdict], border)) console.log(line);
  console.log("");
}

/** Machine-readable report. */
export function renderJson(report: HealthReport): void {
  console.log(JSON.stringify(report, null, 2));
}
