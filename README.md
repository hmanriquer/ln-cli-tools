# Crystal Pulse — by Maia Team

**Crystal Pulse** is an AI-assisted health-check multitool for **React**, **Angular**, and
**Node.js** codebases. It is a **read-only advisor**: it inspects a project, reports
findings and recommendations, and lets *you* decide what to change. It never modifies
your code.

The command is available as both `crystal-pulse` and `pulse`.

## How it works

Two layers, by design:

1. **Deterministic probes** (always run, no API key needed) — the reliable backbone.
   Lockfiles, `engines`, npm scripts, deprecated deps, framework versions, config
   sanity checks, and a `.env`-leak guard. These drive the exit code.
2. **AI analysis** (optional, needs a provider) — by default **Claude** investigates the
   repository with **read-only** tools (`list_dir`, `read_file`, `glob`, `grep`), grounds
   its findings in the actual source, and prioritizes what a linter would miss. It has no
   write/edit/shell access and is purely advisory. A **GitHub Models** provider is also
   available (`--provider github-models`) for environments without an Anthropic key — see
   [AI providers](#ai-providers).

The AI never blocks the deterministic result: if no provider is configured or a call
fails, you still get the full probe report.

## Requirements

- Node.js >= 18
- (Optional) an Anthropic API key for the AI layer

### Authentication

The AI layer needs Anthropic credentials. `crystal-pulse` accepts any of these (SDK resolution order):

1. **API key** — `ANTHROPIC_API_KEY` in the environment.
2. **OAuth token** — `ANTHROPIC_AUTH_TOKEN` (a bearer token, e.g. from `ant auth login`).
3. **OAuth profile** — created by `ant auth login` and stored on disk.
4. **Saved key** — `~/.ln-health/credentials` (chmod `600`), written by the interactive prompt.
5. **Interactive prompt** — in a terminal with none of the above, `crystal-pulse` asks for a key
   (masked) and offers to save it.

No credentials and non-interactive (CI, `--json`, `--no-ai`)? The AI layer is skipped and
the deterministic probes still run.

#### Using Anthropic OAuth (no static key)

If your org uses Claude via OAuth instead of issuing API keys, authenticate with the
Anthropic CLI (`ant`):

```bash
brew install anthropics/tap/ant     # macOS; see Anthropic's CLI docs for Linux/Windows
ant auth login                       # one-time browser OAuth; stores a profile
crystal-pulse check ./app                       # picks up the profile automatically*
```

\* Automatic profile pickup depends on your `@anthropic-ai/sdk` version. The **guaranteed**
path (works everywhere, and refreshes the short-lived token each run) is to export it:

```bash
eval "$(ant auth print-credentials --env)"   # sets ANTHROPIC_AUTH_TOKEN
crystal-pulse check ./app
```

`crystal-pulse` automatically sends the required `anthropic-beta: oauth-2025-04-20` header when it
detects an OAuth token or profile. For CI, mint the token in the pipeline and export it the
same way.

### AI providers

The AI layer supports more than one backend via `--provider` (default `auto`, which picks
the first configured):

| Provider | `--provider` | Auth | Notes |
| --- | --- | --- | --- |
| Claude (Anthropic) | `anthropic` | `ANTHROPIC_API_KEY` / OAuth | Full agentic, read-only tool-use investigation. |
| GitHub Models | `github-models` | `GITHUB_TOKEN` (PAT, `models:read`) | OpenAI-compatible; **not Claude**. MVP/prototyping. |
| Gemini | `gemini` | `GEMINI_API_KEY` (Google AI Studio) | OpenAI-compatible; **not Claude**. Free tier; good for a POC. |

#### Gemini (POC-friendly)

A free Google AI Studio key ([aistudio.google.com](https://aistudio.google.com)) works from any
personal Google account, independent of your org:

```bash
export GEMINI_API_KEY=AIza...
crystal-pulse check . --provider gemini
crystal-pulse check . --provider gemini --model gemini-2.5-flash    # default; override with HC_GEMINI_MODEL
```

⚠️ Free-tier prompts may be used by Google to improve their products, and you'd be sending
source code. Fine for a POC on sample/non-sensitive code; get sign-off before pointing it at
proprietary repositories.

**GitHub Models** helps when your org can't issue Anthropic keys but has GitHub Models
enabled — note this is *separate* from a Copilot seat (a Copilot Enterprise license does
not by itself grant GitHub Models API access). Caveats: it's **not Claude**, it has
**prototyping-grade rate limits**, and for the MVP it runs a **single-call review** (probe
findings + `package.json` / `tsconfig.json` as context) rather than the agentic tool loop.

```bash
export GITHUB_TOKEN=github_pat_...       # fine-grained PAT with the "models" permission
crystal-pulse check . --provider github-models      # or just `crystal-pulse check .` if it's your only creds
crystal-pulse check . --provider github-models --model openai/gpt-4o
```

Overrides: `HC_GITHUB_MODEL` (default `openai/gpt-4o-mini`) and `HC_GITHUB_MODELS_URL`
(default `https://models.github.ai/inference`).

## Setup

```bash
npm install
npm run build          # compile to dist/
npm link               # optional: put `crystal-pulse` on your PATH
cp .env.example .env    # then fill in ANTHROPIC_API_KEY
```

During development you can run without building:

```bash
npm run dev -- check react ./path/to/app
```

## Interactive menu (`--ui`)

Launch a full arrow-key menu with the Crystal Pulse wordmark on top:

```bash
crystal-pulse --ui        # or:  crystal-pulse ui   ·   pulse --ui
```

During development (before `npm link`), use the dedicated script — no `--` needed:

```bash
npm run ui
```

> ⚠️ With `npm run`, flags must come after `--` or npm swallows them:
> `npm run dev -- --ui` works, but `npm run dev --ui` runs plain `tsx src/index.ts`
> (you'll get the help screen). `npm run ui` avoids the gotcha entirely.

From the menu you can run a health check, **manage credentials** (set the Anthropic API key
*or* the GitHub token for GitHub Models — both saved to `~/.ln-health/credentials`), view
configuration, or read the About screen — navigating with the arrow keys and Enter. The menu
requires a real terminal (TTY); in non-interactive contexts use the `check` command directly.

## Usage

```bash
crystal-pulse check                       # interactive: pick stack + path
crystal-pulse check ./my-app              # auto-detect stack, analyze ./my-app
crystal-pulse check react ./my-app        # force the React probe set
crystal-pulse check node .                # Node probes on the current directory
crystal-pulse check . --no-ai             # deterministic probes only
crystal-pulse check . --json              # machine-readable output
crystal-pulse check . --effort medium     # tune AI reasoning effort
crystal-pulse check . --model claude-opus-4-8
```

### Scoping flags (great for pipelines)

Instead of relying on auto-detect, scope a run to specific ecosystems with explicit,
self-documenting flags. They **combine** (union of stacks) and **override** auto-detect:

```bash
crystal-pulse check --react-health                 # only React checks
crystal-pulse check --angular-health               # only Angular checks
crystal-pulse check --node-health                  # only Node.js checks
crystal-pulse check --react-health --node-health   # both, unioned
crystal-pulse check ./app --react-health --json    # scoped, machine-readable, at a path
```

If you request a stack the project doesn't actually have (e.g. `--angular-health` on a
React repo), the run still succeeds and reports a clear `info` notice, so a CI step never
fails silently or ambiguously.

### HTML report (`--html`)

Add `--html` to any `check` to also write a **self-contained** HTML report (inline CSS/JS,
no external assets) and open it in your browser automatically:

```bash
crystal-pulse check . --html                 # writes ./crystal-pulse-report.html and opens it
crystal-pulse check . --html --out report.html
crystal-pulse check . --html --no-open       # write only (CI/headless)
```

The page shows each finding grouped by severity (with the AI summary), and has severity
filters + text search. `--html` is additive — the terminal/JSON output is unchanged.

Each project card also includes a **"Prompt to fix these with Claude"** block — a
ready-to-paste prompt (with a one-click **Copy** button) that summarizes that project's
errors + warnings and their suggested fixes, so you can drop it straight into Claude and get
concrete changes back.

### Scan many projects (`scan`)

`scan` discovers every project (each `package.json`, skipping `node_modules`/`dist`/…) under
a directory, runs the same analysis on each, and opens **one combined dashboard**:

```bash
crystal-pulse scan .                         # analyze every project under . and open the SPA
crystal-pulse scan ../repos --no-ai          # fast, probes-only across a whole folder of repos
crystal-pulse scan . --json --no-open        # combined JSON of all projects, no browser
crystal-pulse scan . --depth 3               # limit discovery depth
```

Projects are analyzed **sequentially**; with AI on, a large tree can hit provider rate/day
limits (each project's AI failure is caught and that project still shows its probe findings).
Use `--no-ai` for a fast, deterministic scan.

### Options

| Flag | Description |
| --- | --- |
| `--json` | Emit the report as JSON (implies non-interactive). |
| `--no-ai` | Skip the AI layer; run deterministic probes only. |
| `--provider <id>` | `auto` (default) \| `anthropic` \| `github-models`. |
| `--react-health` | Scope the run to React checks (combinable). |
| `--angular-health` | Scope the run to Angular checks (combinable). |
| `--node-health` | Scope the run to Node.js checks (combinable). |
| `--model <id>` | Override the Claude model (default `claude-opus-4-8`). |
| `--effort <level>` | `low` \| `medium` \| `high` \| `xhigh` \| `max` (default `high`). |
| `--html` | (`check`) Also write + open a self-contained HTML report. |
| `--out <file>` | (`check`/`scan`) HTML report path (default `<root>/crystal-pulse-report.html`). |
| `--no-open` | (`check`/`scan`) Write the HTML report but don't open a browser. |
| `--depth <n>` | (`scan`) Max directory depth to search for projects. |

`HC_MODEL` and `HC_EFFORT` environment variables provide the same overrides.

### In a pipeline (CI)

The scoping flags plus `--json`/`--no-ai` make CI usage explicit and deterministic. The
process exits `1` only when a **deterministic probe** raises an `error` for the requested
stack(s) — so a scoped step fails only on that ecosystem's hard problems:

```bash
# Fast, deterministic gate for a React service (no API key needed):
crystal-pulse check --react-health --no-ai --json > crystal-pulse-report.json

# With AI review (key from the CI secret store):
ANTHROPIC_API_KEY="$SECRET" crystal-pulse check --react-health --json > crystal-pulse-report.json
```

### Exit codes

`0` clean or advisory-only; `1` when any **deterministic probe** raises an `error`-severity
finding. AI findings are advisory and never change the exit code.

## Architecture

```
src/
  core/       domain types + report logic (pure; imports nothing from infra/ai/cli)
  infra/      sandboxed, read-only filesystem access
  probes/     deterministic collectors, one module per ecosystem + a registry
  ai/         Claude client, read-only tools, prompt, and the agentic loop
  cli/        commander wiring, interactive prompts, rendering
  config.ts   defaults (model, effort, limits, ignored dirs)
```

Adding an ecosystem is a matter of dropping a new module under `probes/` and registering
it — the core and CLI don't change.
