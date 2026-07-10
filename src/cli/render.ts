import path from "node:path";
import pc from "picocolors";
import type { Finding, HealthReport, Severity } from "../core/types.js";
import { summarize } from "../core/report.js";
import { cleanNarrative } from "../core/narrative.js";
import { buildFixPrompt } from "../core/fixPrompt.js";
import { copyToClipboard } from "../infra/clipboard.js";
import { APP_NAME, AUTHOR, SHORT_TAGLINE } from "./brand.js";

type Colorize = (text: string) => string;

/** Claude brand coral via 24-bit ANSI, gated on color support. */
function claude(text: string): string {
  if (!pc.isColorSupported) return text;
  return `\x1b[38;2;217;119;87m${text}\x1b[39m`;
}

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

function projectLabel(report: HealthReport, scanRoot?: string): string {
  if (scanRoot) {
    const rel = path.relative(scanRoot, report.root);
    if (rel && !rel.startsWith("..")) return rel.split(path.sep).join("/");
  }
  return path.basename(report.root) || report.root;
}

/**
 * Print a fix prompt block, copy it to the clipboard, and show the
 * Coming soon Claude Code CTA. Returns whether a prompt was shown.
 */
async function renderOneFixPrompt(
  report: HealthReport,
  opts: { name: string; copy: boolean; copiedNote?: string },
): Promise<boolean> {
  const prompt = buildFixPrompt(report, opts.name);
  if (!prompt) return false;

  console.log(pc.bold(pc.magenta("Fix prompt (Claude)")));
  console.log(pc.dim("─".repeat(48)));
  for (const line of prompt.split("\n")) {
    console.log(pc.dim(line));
  }
  console.log(pc.dim("─".repeat(48)));

  if (opts.copy) {
    const ok = await copyToClipboard(prompt);
    if (ok) {
      console.log(
        pc.green(
          `  ✓ Copied to clipboard${opts.copiedNote ? ` (${opts.copiedNote})` : ""}`,
        ),
      );
    } else {
      console.log(pc.dim("  (Could not copy to clipboard — copy the prompt above manually.)"));
    }
  }

  console.log(
    `  ${claude("✳")} ${pc.bold(claude("Open in Claude Code"))} ${pc.dim("·")} ${pc.dim("coming soon")}`,
  );
  console.log("");
  return true;
}

/** Human-readable report. Auto-copies the fix prompt when present. */
export async function renderReport(report: HealthReport): Promise<void> {
  const { findings } = report;
  const counts = summarize(findings);
  const name = projectLabel(report);

  console.log("");
  console.log(`${pc.dim("target:")} ${report.root}`);
  console.log(
    `${pc.dim("stacks:")} ${report.stacks.join(", ") || pc.dim("unknown")}`,
  );
  console.log("");

  await renderOneFixPrompt(report, { name, copy: true });

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

/**
 * Print fix prompts for a multi-project scan. Copies only the first
 * non-empty prompt to avoid overwriting the clipboard N times.
 */
export async function renderFixPrompts(
  reports: HealthReport[],
  scanRoot?: string,
): Promise<void> {
  let copied = false;
  for (const report of reports) {
    const name = projectLabel(report, scanRoot);
    const prompt = buildFixPrompt(report, name);
    if (!prompt) continue;

    console.log(pc.bold(`${name}`));
    const didCopy = !copied;
    const shown = await renderOneFixPrompt(report, {
      name,
      copy: didCopy,
      copiedNote: didCopy ? name : undefined,
    });
    if (shown && didCopy) copied = true;
  }
}

/**
 * Copy the first non-empty fix prompt from a set of reports.
 * Returns the project name that was copied, or null if none / copy failed.
 */
export async function copyFirstFixPrompt(
  reports: HealthReport[],
  scanRoot?: string,
): Promise<string | null> {
  for (const report of reports) {
    const name = projectLabel(report, scanRoot);
    const prompt = buildFixPrompt(report, name);
    if (!prompt) continue;
    const ok = await copyToClipboard(prompt);
    return ok ? name : null;
  }
  return null;
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
