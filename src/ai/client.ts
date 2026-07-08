import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { detectCredentialSource } from "../infra/credentials.js";

/** OAuth-authenticated requests to /v1/messages require this beta header. */
const OAUTH_BETA = "oauth-2025-04-20";

export class MissingCredentialsError extends Error {
  constructor() {
    super(
      "No Anthropic credentials found. Provide one of:\n" +
        "  • ANTHROPIC_API_KEY (API key), or\n" +
        "  • ANTHROPIC_AUTH_TOKEN (OAuth bearer token), or\n" +
        "  • an OAuth login: `ant auth login` (then run again).\n" +
        "Or pass --no-ai to run deterministic probes only.",
    );
    this.name = "MissingCredentialsError";
  }
}

/**
 * Construct the Anthropic client. Credentials are resolved by the SDK from the
 * environment / `ant auth login` profile; we only decide whether the OAuth beta
 * header is needed. For OAuth sources (env token or on-disk profile) we send
 * `anthropic-beta: oauth-2025-04-20`, which /v1/messages requires for OAuth.
 */
export function createClient(): Anthropic {
  const source = detectCredentialSource();
  if (!source) throw new MissingCredentialsError();

  const options: ClientOptions = {};
  if (source === "auth_token" || source === "oauth_profile") {
    options.defaultHeaders = { "anthropic-beta": OAUTH_BETA };
  }
  return new Anthropic(options);
}
