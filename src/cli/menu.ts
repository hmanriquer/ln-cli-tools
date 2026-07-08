import * as p from "@clack/prompts";
import pc from "picocolors";
import { resolveEffort, resolveModel } from "../config.js";
import {
  credentialsDisplayPath,
  describeCredentialSource,
  detectCredentialSource,
  loadStoredCredentials,
  storeCredential,
} from "../infra/credentials.js";
import {
  providerConfigured,
  providerLabel,
  resolveProviderId,
  type ProviderId,
} from "../ai/providers.js";
import { APP_NAME, AUTHOR } from "./brand.js";
import { runCheck } from "./commands/check.js";
import { runScan } from "./commands/scan.js";
import {
  promptForApiKey,
  promptForCheck,
  promptForGeminiKey,
  promptForGitHubToken,
} from "./interactive.js";
import { selectMenuAction } from "../ui/menu.js";

/**
 * Interactive, arrow-key menu (launched with `--ui` or the `ui` command).
 * A cohesive loop: draw the wordmark, pick an action, run it, return.
 */
export async function runMenu(): Promise<number> {
  if (!process.stdout.isTTY) {
    console.error(
      "The interactive menu (--ui) requires a real terminal (TTY).",
    );
    return 1;
  }

  loadStoredCredentials();
  let lastExitCode = 0;

  for (;;) {
    console.clear();
    const choice = await selectMenuAction({
      options: [
        {
          value: "check",
          label: "Run a health check",
          hint: "one project + HTML report",
        },
        {
          value: "scan",
          label: "Scan multiple projects",
          hint: "folder of repos → dashboard",
        },
        {
          value: "creds",
          label: "Manage credentials",
          hint: "API key / GitHub token",
        },
        { value: "config", label: "Show configuration" },
        { value: "about", label: `About ${APP_NAME}` },
        { value: "exit", label: "Exit" },
      ],
      noKeyHint: resolveProviderId()
        ? undefined
        : 'Pick "Manage credentials", run `ant auth login`, or set GITHUB_TOKEN.',
    });

    if (!choice || choice === "exit") {
      p.outro(pc.dim(`Thanks for using ${APP_NAME}.`));
      return lastExitCode;
    }

    switch (choice) {
      case "check":
        lastExitCode = await runCheckFlow();
        break;
      case "scan":
        lastExitCode = await runScanFlow();
        break;
      case "creds":
        await manageCredentialsFlow();
        break;
      case "config":
        showConfig();
        break;
      case "about":
        showAbout();
        break;
    }

    if (!(await returnToMenu())) {
      p.outro(pc.dim(`Thanks for using ${APP_NAME}.`));
      return lastExitCode;
    }
  }
}

const ALL_PROVIDERS: ProviderId[] = ["anthropic", "github-models", "gemini"];

/**
 * Pick which configured provider to use. Returns the id, or undefined to fall
 * back to `auto`. If exactly one provider is configured, use it without asking.
 */
async function pickProvider(): Promise<ProviderId | undefined> {
  const configured = ALL_PROVIDERS.filter(providerConfigured);
  const first = configured[0];
  if (!first) return undefined;
  if (configured.length === 1) return first;

  const choice = await p.select({
    message: "Which AI provider?",
    initialValue: first,
    options: configured.map((id) => ({ value: id, label: providerLabel(id) })),
  });
  if (p.isCancel(choice)) return undefined;
  return choice;
}

async function runCheckFlow(): Promise<number> {
  const answers = await promptForCheck();

  let ai = answers.ai;
  if (ai && !resolveProviderId()) {
    // No provider configured yet — let them add one, then re-check.
    await manageCredentialsFlow();
    if (!resolveProviderId()) ai = false;
  }

  // Let the user choose when several providers are configured (otherwise `auto`
  // silently prefers Anthropic → GitHub Models → Gemini).
  const provider = ai ? await pickProvider() : undefined;

  // From the UI we always produce + open the HTML report (that's the point).
  return runCheck({
    args: [],
    json: false,
    interactive: true,
    ai,
    provider,
    stack: answers.stack,
    path: answers.path,
    html: true,
    open: true,
  });
}

/** Menu flow: scan a directory of projects and open the combined dashboard. */
async function runScanFlow(): Promise<number> {
  const dir = await p.text({
    message: "Directory to scan",
    placeholder: ".",
    defaultValue: ".",
  });
  if (p.isCancel(dir)) return 0;

  const wantAi = await p.confirm({
    message: "Run AI analysis on each project?",
    initialValue: true,
  });
  if (p.isCancel(wantAi)) return 0;

  let ai = wantAi;
  if (ai && !resolveProviderId()) {
    await manageCredentialsFlow();
    if (!resolveProviderId()) ai = false;
  }
  const provider = ai ? await pickProvider() : undefined;

  return runScan({
    args: [dir || "."],
    json: false,
    interactive: true,
    ai,
    provider,
    open: true,
  });
}

/** Submenu: choose which credential to set, then prompt + (optionally) save it. */
async function manageCredentialsFlow(): Promise<void> {
  const which = await p.select({
    message: "Which credential do you want to set?",
    options: [
      { value: "anthropic", label: "Anthropic API key", hint: "Claude" },
      { value: "github", label: "GitHub token", hint: "GitHub Models" },
      { value: "gemini", label: "Gemini API key", hint: "Google AI Studio" },
      { value: "back", label: "Back" },
    ],
  });
  if (p.isCancel(which) || which === "back") return;
  if (which === "anthropic") await setAnthropicKey();
  else if (which === "github") await setGitHubToken();
  else await setGeminiKey();
}

async function setAnthropicKey(): Promise<void> {
  const result = await promptForApiKey({ silent: true });
  if (!result) return;
  process.env.ANTHROPIC_API_KEY = result.key;
  if (result.save) {
    storeCredential("ANTHROPIC_API_KEY", result.key);
    p.log.success(`Saved to ${pc.dim(credentialsDisplayPath())}.`);
  } else {
    p.log.info("Set for this session only.");
  }
}

async function setGitHubToken(): Promise<void> {
  const result = await promptForGitHubToken({ silent: true });
  if (!result) return;
  process.env.GITHUB_TOKEN = result.token;
  if (result.save) {
    storeCredential("GITHUB_TOKEN", result.token);
    p.log.success(`Saved to ${pc.dim(credentialsDisplayPath())}.`);
  } else {
    p.log.info("Set for this session only.");
  }
}

async function setGeminiKey(): Promise<void> {
  const result = await promptForGeminiKey({ silent: true });
  if (!result) return;
  process.env.GEMINI_API_KEY = result.key;
  if (result.save) {
    storeCredential("GEMINI_API_KEY", result.key);
    p.log.success(`Saved to ${pc.dim(credentialsDisplayPath())}.`);
  } else {
    p.log.info("Set for this session only.");
  }
}

function showConfig(): void {
  const source = detectCredentialSource();
  const key = process.env.ANTHROPIC_API_KEY;
  const masked =
    source === "api_key" && key
      ? pc.dim(`  ${key.slice(0, 7)}…${key.slice(-4)}`)
      : "";
  const authLine = source
    ? pc.green(describeCredentialSource(source)) + masked
    : pc.dim("no Anthropic auth");
  const providerId = resolveProviderId();
  const providerLine = providerId
    ? pc.green(providerLabel(providerId))
    : pc.yellow("none configured");
  const gh = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const ghLine = gh
    ? pc.green("set") + pc.dim(`  ${gh.slice(0, 12)}…`)
    : pc.dim("not set");
  const gem = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const gemLine = gem
    ? pc.green("set") + pc.dim(`  ${gem.slice(0, 8)}…`)
    : pc.dim("not set");
  p.note(
    [
      `${pc.bold("Provider")}    ${providerLine}`,
      `${pc.bold("Anthropic")}   ${authLine}`,
      `${pc.bold("GitHub")}      ${ghLine}`,
      `${pc.bold("Gemini")}      ${gemLine}`,
      `${pc.bold("Stored at")}   ${pc.dim(credentialsDisplayPath())}`,
      `${pc.bold("Model")}       ${resolveModel()}`,
      `${pc.bold("Effort")}      ${resolveEffort()}`,
    ].join("\n"),
    "Configuration",
  );
}

function showAbout(): void {
  p.note(
    [
      `${pc.bold(APP_NAME)} ${pc.dim(AUTHOR)}`,
      ``,
      `A read-only health-check multitool for React, Angular and Node.js`,
      `codebases. It runs deterministic probes and (optionally) an AI`,
      `investigation, then reports findings and recommendations.`,
      ``,
      pc.dim("It never changes your code — you decide what to act on."),
      ``,
      `${pc.bold("CLI:")}  crystal-pulse check [stack] [path]   ${pc.dim("·")}   crystal-pulse check . --json`,
    ].join("\n"),
    `About ${APP_NAME}`,
  );
}

async function returnToMenu(): Promise<boolean> {
  const again = await p.confirm({
    message: "Return to the menu?",
    initialValue: true,
  });
  if (p.isCancel(again)) return false;
  return again;
}
