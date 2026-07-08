import type { Probe } from "../../core/types.js";
import { depRange, finding, hasDep, majorFromRange } from "../shared/util.js";

/** Angular-specific probes. Applies when @angular/core is a dependency. */
export const angularProbes: Probe[] = [
  {
    id: "angular/version",
    stack: "angular",
    appliesTo: (ctx) => hasDep(ctx, "@angular/core"),
    run: (ctx) => {
      const major = majorFromRange(depRange(ctx, "@angular/core"));
      if (major === null) return [];
      // Angular supports roughly the latest two majors with active + LTS windows.
      if (major < 16) {
        return [
          finding(
            "angular",
            "eol-version",
            "error",
            `Angular ${major} is out of support`,
            "Angular versions older than 16 no longer receive security fixes.",
            { file: "package.json", recommendation: "Upgrade one major at a time using `ng update`." },
          ),
        ];
      }
      if (major < 18) {
        return [
          finding(
            "angular",
            "aging-version",
            "warning",
            `Angular ${major} is behind the current major`,
            "Staying within the supported window keeps you eligible for security patches and tooling fixes.",
            { file: "package.json", recommendation: "Plan a stepwise `ng update` to a supported major." },
          ),
        ];
      }
      return [];
    },
  },
  {
    id: "angular/workspace",
    stack: "angular",
    appliesTo: (ctx) => hasDep(ctx, "@angular/core"),
    run: (ctx) => {
      if (ctx.files.exists("angular.json")) return [];
      return [
        finding(
          "angular",
          "no-workspace",
          "warning",
          "No angular.json workspace file",
          "@angular/core is a dependency but no CLI workspace config was found — the build setup may be non-standard.",
          { recommendation: "Verify the project uses the Angular CLI, or document the custom build." },
        ),
      ];
    },
  },
  {
    id: "angular/strict",
    stack: "angular",
    appliesTo: (ctx) => hasDep(ctx, "@angular/core") && ctx.files.exists("tsconfig.json"),
    run: (ctx) => {
      const raw = ctx.files.read("tsconfig.json") ?? "";
      // Angular's strict mode sets compilerOptions.strict and angularCompilerOptions.strictTemplates.
      const strict = /"strict"\s*:\s*true/.test(raw);
      if (strict) return [];
      return [
        finding(
          "angular",
          "not-strict",
          "info",
          "TypeScript strict mode is not enabled",
          "Angular's strict mode surfaces template and type errors far earlier.",
          { file: "tsconfig.json", recommendation: 'Enable "strict": true (and strictTemplates).' },
        ),
      ];
    },
  },
  {
    id: "angular/rxjs",
    stack: "angular",
    appliesTo: (ctx) => hasDep(ctx, "@angular/core"),
    run: (ctx) => {
      const major = majorFromRange(depRange(ctx, "rxjs"));
      if (major !== null && major < 7) {
        return [
          finding(
            "angular",
            "old-rxjs",
            "warning",
            `RxJS ${major} is outdated`,
            "Modern Angular expects RxJS 7+. Older versions can cause peer-dependency and typing friction.",
            { file: "package.json", recommendation: "Upgrade RxJS to 7.x alongside your Angular upgrade." },
          ),
        ];
      }
      return [];
    },
  },
];
