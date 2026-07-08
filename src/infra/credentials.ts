import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".ln-health");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials");

/**
 * How the AI layer is (or would be) authenticated, in the SDK's own resolution
 * order: a first-party API key, a bearer/OAuth token in the env, or an
 * `ant auth login` OAuth profile stored on disk.
 */
export type CredentialSource = "api_key" | "auth_token" | "oauth_profile";

/** Directory where the Anthropic CLI stores OAuth profiles. */
function antConfigDir(): string {
  if (process.env.ANTHROPIC_CONFIG_DIR) return process.env.ANTHROPIC_CONFIG_DIR;
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Anthropic");
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(xdg, "anthropic");
}

/** True if `ant auth login` appears to have stored at least one OAuth profile. */
export function oauthProfileExists(): boolean {
  try {
    const credDir = path.join(antConfigDir(), "credentials");
    return existsSync(credDir) && readdirSync(credDir).some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}

/** Detect which credential the SDK will use, or null if none is available. */
export function detectCredentialSource(): CredentialSource | null {
  if (process.env.ANTHROPIC_API_KEY) return "api_key";
  if (process.env.ANTHROPIC_AUTH_TOKEN) return "auth_token";
  if (oauthProfileExists()) return "oauth_profile";
  return null;
}

/** True when the AI layer has some form of credential available. */
export function hasCredentials(): boolean {
  return detectCredentialSource() !== null;
}

/** Human-readable label for the active credential source. */
export function describeCredentialSource(source = detectCredentialSource()): string {
  switch (source) {
    case "api_key":
      return "API key (ANTHROPIC_API_KEY)";
    case "auth_token":
      return "OAuth token (ANTHROPIC_AUTH_TOKEN)";
    case "oauth_profile":
      return "OAuth login (ant auth login)";
    default:
      return "none";
  }
}

/** Location of the user-level credentials file (for display in prompts). */
export function credentialsPath(): string {
  return CREDENTIALS_FILE;
}

/** Short, home-relative form for display, e.g. ~/.ln-health/credentials. */
export function credentialsDisplayPath(): string {
  const rel = path.relative(os.homedir(), CREDENTIALS_FILE);
  return rel.startsWith("..") ? CREDENTIALS_FILE : `~/${rel.split(path.sep).join("/")}`;
}

/** Credentials Pulse can persist in its user-level file. */
export const STORED_KEYS = ["ANTHROPIC_API_KEY", "GITHUB_TOKEN", "GEMINI_API_KEY"] as const;
export type StoredKey = (typeof STORED_KEYS)[number];

/** Parse the KEY=VALUE credentials file into a map (empty on any error). */
function parseCredentialsFile(): Record<string, string> {
  const out: Record<string, string> = {};
  const lineRe = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/;
  try {
    if (!existsSync(CREDENTIALS_FILE)) return out;
    for (const line of readFileSync(CREDENTIALS_FILE, "utf8").split(/\r?\n/)) {
      const m = lineRe.exec(line);
      const key = m?.[1];
      if (key) out[key] = m?.[2] ?? "";
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Load any saved credentials into process.env, without overriding values that
 * are already set in the environment (env wins over the stored file).
 */
export function loadStoredCredentials(): void {
  const stored = parseCredentialsFile();
  for (const key of STORED_KEYS) {
    const value = stored[key];
    if (value && !process.env[key]) process.env[key] = value;
  }
}

/**
 * Persist (merge) one credential into the user config file with owner-only
 * permissions, preserving the other stored credentials.
 */
export function storeCredential(name: StoredKey, value: string): string {
  const stored = parseCredentialsFile();
  stored[name] = value;
  const body =
    STORED_KEYS.filter((k) => stored[k]).map((k) => `${k}=${stored[k] ?? ""}`).join("\n") + "\n";
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CREDENTIALS_FILE, body, { mode: 0o600 });
  try {
    chmodSync(CREDENTIALS_FILE, 0o600); // no-op semantics on Windows, but harmless
  } catch {
    /* ignore */
  }
  return CREDENTIALS_FILE;
}
