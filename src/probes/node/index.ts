import type { Probe } from "../../core/types.js";
import { allDeps, finding, majorFromRange } from "../shared/util.js";

/** Node.js / general JS project probes. Applies whenever a package.json exists. */
export const nodeProbes: Probe[] = [
  {
    id: "node/lockfile",
    stack: "node",
    appliesTo: (ctx) => ctx.packageJson !== null,
    run: (ctx) => {
      const locks = [
        "package-lock.json",
        "npm-shrinkwrap.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lockb",
      ].filter((f) => ctx.files.exists(f));

      if (locks.length === 0) {
        return [
          finding(
            "node",
            "missing-lockfile",
            "error",
            "No dependency lockfile found",
            "Without a lockfile, installs are non-reproducible and builds can drift between machines and CI.",
            { recommendation: "Commit a lockfile (e.g. run `npm install` and commit package-lock.json)." },
          ),
        ];
      }
      if (locks.length > 1) {
        return [
          finding(
            "node",
            "multiple-lockfiles",
            "warning",
            `Multiple lockfiles present (${locks.join(", ")})`,
            "Mixing package managers leads to conflicting resolutions and confusing CI behavior.",
            { recommendation: "Pick one package manager and delete the other lockfiles." },
          ),
        ];
      }
      return [];
    },
  },
  {
    id: "node/engines",
    stack: "node",
    appliesTo: (ctx) => ctx.packageJson !== null,
    run: (ctx) => {
      const engines = ctx.packageJson?.engines;
      if (!engines || !engines["node"]) {
        return [
          finding(
            "node",
            "no-engines-node",
            "info",
            "No `engines.node` constraint declared",
            "Declaring a supported Node range prevents contributors and CI from running on incompatible versions.",
            { file: "package.json", recommendation: 'Add "engines": { "node": ">=18" } to package.json.' },
          ),
        ];
      }
      return [];
    },
  },
  {
    id: "node/scripts",
    stack: "node",
    appliesTo: (ctx) => ctx.packageJson !== null,
    run: (ctx) => {
      const scripts = ctx.packageJson?.scripts ?? {};
      const out = [];
      if (!scripts["test"]) {
        out.push(
          finding(
            "node",
            "no-test-script",
            "warning",
            "No `test` npm script",
            "A missing test entry point is a strong signal the project lacks an automated test workflow.",
            { file: "package.json", recommendation: "Add a `test` script wired to your test runner." },
          ),
        );
      }
      if (!scripts["lint"]) {
        out.push(
          finding(
            "node",
            "no-lint-script",
            "info",
            "No `lint` npm script",
            "A lint script gives a single, discoverable entry point for static checks.",
            { file: "package.json", recommendation: "Add a `lint` script (e.g. eslint)." },
          ),
        );
      }
      return out;
    },
  },
  {
    id: "node/deprecated-deps",
    stack: "node",
    appliesTo: (ctx) => ctx.packageJson !== null,
    run: (ctx) => {
      const deps = allDeps(ctx.packageJson);
      const deprecated: Record<string, string> = {
        request: "The `request` package is deprecated; use fetch (built-in) or undici/axios.",
        moment: "`moment` is in maintenance mode; prefer date-fns, dayjs, or Temporal.",
        tslint: "`tslint` is deprecated; migrate to typescript-eslint.",
        "left-pad": "Trivial micro-dependency; inline it.",
      };
      return Object.keys(deprecated)
        .filter((name) => name in deps)
        .map((name) =>
          finding(
            "node",
            `deprecated-${name}`,
            "warning",
            `Deprecated dependency: ${name}`,
            deprecated[name] as string,
            { file: "package.json", recommendation: `Replace or remove \`${name}\`.` },
          ),
        );
    },
  },
  {
    id: "node/env-committed",
    stack: "node",
    appliesTo: () => true,
    run: (ctx) => {
      // A committed .env is a common secret-leak vector. We only flag its presence
      // alongside a missing .gitignore rule — we never read its contents.
      if (!ctx.files.exists(".env")) return [];
      const gitignore = ctx.files.read(".gitignore") ?? "";
      const ignored = /(^|\n)\s*\.env(\.|\b|\/|\*|$)/.test(gitignore);
      if (ignored) return [];
      return [
        finding(
          "node",
          "env-not-ignored",
          "error",
          "`.env` present but not covered by .gitignore",
          "Environment files frequently hold secrets. If committed, they can leak credentials into history.",
          { file: ".env", recommendation: "Add `.env` to .gitignore and rotate any exposed secrets." },
        ),
      ];
    },
  },
  {
    id: "node/module-type",
    stack: "node",
    appliesTo: (ctx) => ctx.packageJson !== null,
    run: (ctx) => {
      const pkg = ctx.packageJson;
      if (!pkg) return [];
      const usesTsConfig = ctx.files.exists("tsconfig.json");
      if (!pkg.type && !usesTsConfig) {
        return [
          finding(
            "node",
            "no-module-type",
            "info",
            'No `type` field in package.json',
            'Node defaults to CommonJS. Set "type" explicitly to make the module system unambiguous.',
            { file: "package.json", recommendation: 'Set "type": "module" or "type": "commonjs".' },
          ),
        ];
      }
      return [];
    },
  },
];

export function nodeMajor(range: string | undefined): number | null {
  return majorFromRange(range);
}
