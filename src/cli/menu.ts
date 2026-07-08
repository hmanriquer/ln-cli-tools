import path from "node:path";
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
import { computeExitCode } from "../core/report.js";
import type { Stack } from "../core/types.js";
import { discoverProjects } from "../infra/discover.js";
import { APP_NAME, AUTHOR } from "./brand.js";
import { analyzeProject } from "./commands/analyzeProject.js";
import { resolveRoot } from "./commands/check.js";
import { emitHtmlReport } from "./html.js";
import { createUiHost, type UiHost } from "../ui/menu.js";
import type { RunHooks } from "../ui/apps/RunApp.js";
import { COLOR } from "../ui/theme.js";

/**
 * Interactive, arrow-key menu (launched with `--ui` or the `ui` command).
 * One persistent Ink host owns the screen: the wordmark stays pinned on top
 * and every view (menu, form, run/scan, panel) swaps the body in place.
 */
export async function runMenu(): Promise<number> {
  if (!process.stdout.isTTY) {
    console.error(
      "The interactive menu (--ui) requires a real terminal (TTY).",
    );
    return 1;
  }

  loadStoredCredentials();
  const ui = createUiHost();
  let lastExitCode = 0;

  try {
    for (;;) {
      const choice = await ui.menu({
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

      if (!choice || choice === "exit") break;

      switch (choice) {
        case "check":
          lastExitCode = await runCheckFlow(ui);
          break;
        case "scan":
          lastExitCode = await runScanFlow(ui);
          break;
        case "creds":
          await manageCredentialsFlow(ui);
          break;
        case "config":
          await showConfig(ui);
          break;
        case "about":
          await showAbout(ui);
          break;
      }
    }
  } finally {
    await ui.close();
  }

  console.log(`\nThanks for using ${APP_NAME}.\n`);
  return lastExitCode;
}

const ALL_PROVIDERS: ProviderId[] = ["anthropic", "github-models", "gemini"];

/**
 * Pick which configured provider to use. Returns the id, or undefined to fall
 * back to `auto`. If exactly one provider is configured, use it without asking.
 */
async function pickProvider(ui: UiHost): Promise<ProviderId | undefined> {
  const configured = ALL_PROVIDERS.filter(providerConfigured);
  const first = configured[0];
  if (!first) return undefined;
  if (configured.length === 1) return first;

  const choice = await ui.select(
    "Which AI provider?",
    configured.map((id) => ({ value: id, label: providerLabel(id) })),
  );
  return (choice as ProviderId | null) ?? undefined;
}

async function runCheckFlow(ui: UiHost): Promise<number> {
  const stack = await ui.select("Which stack?", [
    { value: "auto", label: "Auto-detect", hint: "recommended" },
    { value: "node", label: "Node.js" },
    { value: "react", label: "React" },
    { value: "angular", label: "Angular" },
  ]);
  if (stack === null) return 0;

  const projectPath = await ui.text({
    message: "Project path",
    placeholder: ".",
    defaultValue: ".",
  });
  if (projectPath === null) return 0;

  const wantAi = await ui.confirm("Run AI analysis?", true);
  if (wantAi === null) return 0;

  let ai = wantAi;
  if (ai && !resolveProviderId()) {
    await manageCredentialsFlow(ui);
    if (!resolveProviderId()) ai = false;
  }
  const provider = ai ? await pickProvider(ui) : undefined;

  let root: string;
  try {
    root = resolveRoot(projectPath || ".");
  } catch (err) {
    await ui.note(
      "Error",
      [err instanceof Error ? err.message : String(err)],
      COLOR.error,
    );
    return 1;
  }

  const outPath = path.join(root, "crystal-pulse-report.html");
  const report = await ui.run(
    {
      provider: ai ? (provider ?? "auto") : "probes only",
      model: ai ? resolveModel() : undefined,
      effort: ai ? resolveEffort() : undefined,
    },
    (hooks: RunHooks) =>
      analyzeProject({
        root,
        ai,
        provider,
        stack: stack as Stack | "auto",
        onActivity: hooks.onActivity,
        onPhase: hooks.onPhase,
      }),
    (r) => emitHtmlReport([r], { outPath, open: true }),
  );
  return computeExitCode(report.findings);
}

/** Menu flow: scan a directory of projects and open the combined dashboard. */
async function runScanFlow(ui: UiHost): Promise<number> {
  const dir = await ui.text({
    message: "Directory to scan",
    placeholder: ".",
    defaultValue: ".",
  });
  if (dir === null) return 0;

  const wantAi = await ui.confirm("Run AI analysis on each project?", true);
  if (wantAi === null) return 0;

  let ai = wantAi;
  if (ai && !resolveProviderId()) {
    await manageCredentialsFlow(ui);
    if (!resolveProviderId()) ai = false;
  }
  const provider = ai ? await pickProvider(ui) : undefined;

  let scanRoot: string;
  try {
    scanRoot = resolveRoot(dir || ".");
  } catch (err) {
    await ui.note(
      "Error",
      [err instanceof Error ? err.message : String(err)],
      COLOR.error,
    );
    return 1;
  }

  const projectDirs = (await discoverProjects(scanRoot)).map((d) =>
    path.resolve(d),
  );
  if (projectDirs.length === 0) {
    await ui.note(
      "Scan",
      [`No projects (package.json) found under ${scanRoot}.`],
      COLOR.warning,
    );
    return 0;
  }

  const names = projectDirs.map(
    (d) => path.relative(scanRoot, d) || path.basename(d),
  );
  const outPath = path.join(scanRoot, "crystal-pulse-report.html");

  const reports = await ui.scan(
    names,
    {
      provider: ai ? (provider ?? "auto") : "probes only",
      model: ai ? resolveModel() : undefined,
      effort: ai ? resolveEffort() : undefined,
    },
    (index, hooks: RunHooks) =>
      analyzeProject({
        root: projectDirs[index] as string,
        ai,
        provider,
        stack: "auto",
        onActivity: hooks.onActivity,
        onPhase: hooks.onPhase,
      }),
    (rs) => emitHtmlReport(rs, { outPath, open: true, scanRoot }),
  );
  return computeExitCode(reports.flatMap((r) => r.findings));
}

/** Submenu: choose which credential to set, then prompt + (optionally) save it. */
async function manageCredentialsFlow(ui: UiHost): Promise<void> {
  const which = await ui.select("Which credential do you want to set?", [
    { value: "anthropic", label: "Anthropic API key", hint: "Claude" },
    { value: "github", label: "GitHub token", hint: "GitHub Models" },
    { value: "gemini", label: "Gemini API key", hint: "Google AI Studio" },
    { value: "back", label: "Back" },
  ]);
  if (which === null || which === "back") return;
  if (which === "anthropic") await setAnthropicKey(ui);
  else if (which === "github") await setGitHubToken(ui);
  else await setGeminiKey(ui);
}

const GITHUB_TOKEN_RE = /^(github_pat_|ghp_|gho_|ghu_|ghs_)/;

async function saveOrSession(
  ui: UiHost,
  env: "ANTHROPIC_API_KEY" | "GITHUB_TOKEN" | "GEMINI_API_KEY",
  value: string,
): Promise<void> {
  process.env[env] = value;
  const save = await ui.confirm(
    `Save it to ${credentialsDisplayPath()} for next time?`,
    true,
  );
  if (save) {
    storeCredential(env, value);
    await ui.note(
      "Saved",
      [`Stored in ${credentialsDisplayPath()}.`],
      COLOR.ok,
    );
  }
}

async function setAnthropicKey(ui: UiHost): Promise<void> {
  const key = await ui.password({
    message: "Paste your Anthropic API key (Enter to skip)",
    placeholder: "sk-ant-…",
    validate: (v) =>
      !v || v.startsWith("sk-ant-")
        ? undefined
        : "Expected it to start with sk-ant-.",
  });
  if (!key) return;
  await saveOrSession(ui, "ANTHROPIC_API_KEY", key);
}

async function setGitHubToken(ui: UiHost): Promise<void> {
  const token = await ui.password({
    message: "Paste your GitHub token (Enter to skip)",
    placeholder: "github_pat_… / ghp_…",
    validate: (v) =>
      !v || GITHUB_TOKEN_RE.test(v)
        ? undefined
        : "Expected github_pat_… or ghp_….",
  });
  if (!token) return;
  await saveOrSession(ui, "GITHUB_TOKEN", token);
}

async function setGeminiKey(ui: UiHost): Promise<void> {
  const key = await ui.password({
    message: "Paste your Gemini API key (Enter to skip)",
    placeholder: "from Google AI Studio",
    validate: (v) =>
      !v || v.length >= 20
        ? undefined
        : "That doesn't look like a Gemini API key.",
  });
  if (!key) return;
  await saveOrSession(ui, "GEMINI_API_KEY", key);
}

async function showConfig(ui: UiHost): Promise<void> {
  const source = detectCredentialSource();
  const key = process.env.ANTHROPIC_API_KEY;
  const masked =
    source === "api_key" && key ? `  ${key.slice(0, 7)}…${key.slice(-4)}` : "";
  const authLine = source
    ? describeCredentialSource(source) + masked
    : "no Anthropic auth";
  const providerId = resolveProviderId();
  const providerLine = providerId
    ? providerLabel(providerId)
    : "none configured";
  const gh = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const ghLine = gh ? `set  ${gh.slice(0, 12)}…` : "not set";
  const gem = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const gemLine = gem ? `set  ${gem.slice(0, 8)}…` : "not set";
  await ui.note(
    "Configuration",
    [
      `Provider    ${providerLine}`,
      `Anthropic   ${authLine}`,
      `GitHub      ${ghLine}`,
      `Gemini      ${gemLine}`,
      `Stored at   ${credentialsDisplayPath()}`,
      `Model       ${resolveModel()}`,
      `Effort      ${resolveEffort()}`,
    ],
    COLOR.info,
  );
}

async function showAbout(ui: UiHost): Promise<void> {
  await ui.note(
    `About ${APP_NAME}`,
    [
      `${APP_NAME} ${AUTHOR}`,
      ``,
      `A read-only health-check multitool for React, Angular and Node.js`,
      `codebases. It runs deterministic probes and (optionally) an AI`,
      `investigation, then reports findings and recommendations.`,
      ``,
      `It never changes your code — you decide what to act on.`,
      ``,
      `CLI:  crystal-pulse check [stack] [path]   ·   crystal-pulse check . --json`,
    ],
    COLOR.brandB,
  );
}
