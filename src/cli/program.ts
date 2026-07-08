import { Command, Option } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  credentialsDisplayPath,
  hasCredentials,
  loadStoredCredentials,
  storeCredential,
} from "../infra/credentials.js";
import type { Stack } from "../core/types.js";
import { PROVIDER_CHOICES, providerConfigured, resolveProviderId } from "../ai/providers.js";
import { runCheck } from "./commands/check.js";
import { runScan } from "./commands/scan.js";
import { promptForApiKey, promptForCheck } from "./interactive.js";
import { renderBanner, renderNoKeyWarning } from "./render.js";
import { runMenu } from "./menu.js";

interface CheckCliOptions {
  json?: boolean;
  ai?: boolean;
  reactHealth?: boolean;
  angularHealth?: boolean;
  nodeHealth?: boolean;
  provider?: string;
  model?: string;
  effort?: string;
  html?: boolean;
  out?: string;
  open?: boolean;
}

interface ScanCliOptions {
  json?: boolean;
  ai?: boolean;
  provider?: string;
  model?: string;
  effort?: string;
  out?: string;
  open?: boolean;
  depth?: number;
}

/** Explicit per-ecosystem flags (combinable → union of stacks). */
function requestedStacksFrom(options: CheckCliOptions): Stack[] {
  const stacks: Stack[] = [];
  if (options.reactHealth) stacks.push("react");
  if (options.angularHealth) stacks.push("angular");
  if (options.nodeHealth) stacks.push("node");
  return stacks;
}

/**
 * On the Anthropic track with nothing configured, offer to enter/save a key.
 * The prompt fires only for an explicit `--provider anthropic`, or `auto` when
 * no provider at all is configured (a set GitHub/Gemini key means auto resolves
 * elsewhere, so we don't nag for an Anthropic key).
 */
async function maybePromptForAnthropicKey(providerOpt: string): Promise<void> {
  const onAnthropicTrack =
    providerOpt === "anthropic" || (providerOpt === "auto" && resolveProviderId() === null);
  if (!onAnthropicTrack || hasCredentials()) return;

  const result = await promptForApiKey({ silent: true });
  if (!result) return;
  process.env.ANTHROPIC_API_KEY = result.key;
  if (result.save) {
    storeCredential("ANTHROPIC_API_KEY", result.key);
    p.log.success(`Saved to ${pc.dim(credentialsDisplayPath())}.`);
  }
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("crystal-pulse")
    .description("Crystal Pulse — AI-assisted health-check multitool for React, Angular and Node.js codebases.")
    .version("0.2.0")
    .option("--ui", "launch the interactive arrow-key menu")
    .action(async () => {
      // Runs only when no subcommand is given (e.g. `hc`, `hc --ui`).
      if (program.opts().ui) {
        process.exitCode = await runMenu();
      } else {
        program.outputHelp();
      }
    });

  program
    .command("ui")
    .description("Launch the interactive arrow-key menu")
    .action(async () => {
      process.exitCode = await runMenu();
    });

  program
    .command("check")
    .description("Run a health check. Usage: hc check [stack] [path]")
    .argument("[stack]", "node | react | angular (omit to auto-detect, or pass a path here)")
    .argument("[path]", "project directory")
    .option("--json", "output machine-readable JSON", false)
    .option("--no-ai", "skip the AI analysis layer (deterministic probes only)")
    .option("--react-health", "scope the run to React checks")
    .option("--angular-health", "scope the run to Angular checks")
    .option("--node-health", "scope the run to Node.js checks")
    .addOption(
      new Option("--provider <id>", "AI provider").choices([...PROVIDER_CHOICES]).default("auto"),
    )
    .option("--model <id>", "override the model")
    .option("--effort <level>", "reasoning effort: low | medium | high | xhigh | max")
    .option("--html", "also write and open a self-contained HTML report", false)
    .option("--out <file>", "path for the HTML report (default <root>/crystal-pulse-report.html)")
    .option("--no-open", "don't open the HTML report in a browser")
    .action(async (stackArg, pathArg, options: CheckCliOptions) => {
      const json = Boolean(options.json);
      const interactive = Boolean(process.stdout.isTTY) && !json;
      const args = [stackArg, pathArg].filter((v): v is string => typeof v === "string");

      const requestedStacks = requestedStacksFrom(options);
      const hasHealthFlags = requestedStacks.length > 0;
      const providerOpt = options.provider ?? "auto";
      // commander sets options.ai=false only when --no-ai is passed.
      let aiWanted = options.ai !== false;

      if (!json) renderBanner();

      // Make previously-saved credentials available before we decide anything.
      loadStoredCredentials();

      // Top-of-screen heads-up when the AI is wanted but the provider isn't configured.
      const resolvedProvider = resolveProviderId(providerOpt);
      if (!json && aiWanted && !(resolvedProvider && providerConfigured(resolvedProvider))) {
        renderNoKeyWarning(
          providerOpt === "github-models"
            ? "Set GITHUB_TOKEN (a PAT with models:read), or pass --no-ai to skip AI."
            : undefined,
        );
      }

      // Interactive selection only when run bare (no positionals, no health flags) in a TTY.
      let stack: Stack | "auto" | undefined;
      let projectPath: string | undefined;
      if (args.length === 0 && !hasHealthFlags && interactive) {
        const answers = await promptForCheck();
        stack = answers.stack;
        projectPath = answers.path;
        aiWanted = answers.ai;
      }

      if (aiWanted && interactive) await maybePromptForAnthropicKey(providerOpt);

      const code = await runCheck({
        args,
        json,
        interactive,
        ai: aiWanted,
        model: options.model,
        effort: options.effort,
        provider: providerOpt,
        stack,
        path: projectPath,
        stacks: hasHealthFlags ? requestedStacks : undefined,
        html: Boolean(options.html),
        out: options.out,
        open: options.open,
      });
      process.exitCode = code;
    });

  program
    .command("scan")
    .description("Discover & analyze every project under a directory; opens a combined HTML report.")
    .argument("[path]", "directory to scan (defaults to the current directory)")
    .option("--json", "output combined JSON instead of the terminal summary", false)
    .option("--no-ai", "skip the AI analysis layer (probes only)")
    .addOption(
      new Option("--provider <id>", "AI provider").choices([...PROVIDER_CHOICES]).default("auto"),
    )
    .option("--model <id>", "override the model")
    .option("--effort <level>", "reasoning effort: low | medium | high | xhigh | max")
    .option("--out <file>", "path for the HTML report (default <scan-root>/crystal-pulse-report.html)")
    .option("--no-open", "don't open the HTML report in a browser")
    .option("--depth <n>", "max directory depth to search for projects", (v) => Number.parseInt(v, 10))
    .action(async (pathArg, options: ScanCliOptions) => {
      const json = Boolean(options.json);
      const interactive = Boolean(process.stdout.isTTY) && !json;
      const providerOpt = options.provider ?? "auto";
      const aiWanted = options.ai !== false;

      if (!json) renderBanner();
      loadStoredCredentials();

      const resolved = resolveProviderId(providerOpt);
      if (!json && aiWanted && !(resolved && providerConfigured(resolved))) {
        renderNoKeyWarning(
          providerOpt === "github-models"
            ? "Set GITHUB_TOKEN (a PAT with models:read), or pass --no-ai to skip AI."
            : undefined,
        );
      }
      if (aiWanted && interactive) await maybePromptForAnthropicKey(providerOpt);

      const code = await runScan({
        args: typeof pathArg === "string" ? [pathArg] : [],
        json,
        interactive,
        ai: aiWanted,
        provider: providerOpt,
        model: options.model,
        effort: options.effort,
        out: options.out,
        open: options.open,
        depth: Number.isFinite(options.depth) ? options.depth : undefined,
      });
      process.exitCode = code;
    });

  return program;
}
