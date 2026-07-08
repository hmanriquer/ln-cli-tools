import type { Probe } from "../../core/types.js";
import { depRange, finding, hasDep, majorFromRange } from "../shared/util.js";

/** React-specific probes. Applies when react/react-dom is a dependency. */
export const reactProbes: Probe[] = [
  {
    id: "react/version",
    stack: "react",
    appliesTo: (ctx) => hasDep(ctx, "react"),
    run: (ctx) => {
      const major = majorFromRange(depRange(ctx, "react"));
      if (major === null) return [];
      if (major < 18) {
        return [
          finding(
            "react",
            "legacy-version",
            "warning",
            `React ${major}.x is behind the current major`,
            "React 18 introduced concurrent rendering and automatic batching. Older majors miss security patches and modern APIs.",
            { file: "package.json", recommendation: "Plan an upgrade to React 18+." },
          ),
        ];
      }
      return [];
    },
  },
  {
    id: "react/cra",
    stack: "react",
    appliesTo: (ctx) => hasDep(ctx, "react-scripts"),
    run: () => [
      finding(
        "react",
        "create-react-app",
        "warning",
        "Project uses Create React App (react-scripts)",
        "CRA is no longer actively maintained and is not recommended for new apps.",
        { file: "package.json", recommendation: "Migrate to Vite, Next.js, or another maintained toolchain." },
      ),
    ],
  },
  {
    id: "react/hooks-lint",
    stack: "react",
    appliesTo: (ctx) => hasDep(ctx, "react"),
    run: (ctx) => {
      if (hasDep(ctx, "eslint-plugin-react-hooks")) return [];
      return [
        finding(
          "react",
          "no-hooks-lint",
          "info",
          "eslint-plugin-react-hooks not installed",
          "The hooks lint plugin catches missing dependency arrays and conditional hook calls — common, hard-to-spot bugs.",
          { recommendation: "Add eslint-plugin-react-hooks and enable rules-of-hooks + exhaustive-deps." },
        ),
      ];
    },
  },
  {
    id: "react/testing",
    stack: "react",
    appliesTo: (ctx) => hasDep(ctx, "react"),
    run: (ctx) => {
      const hasRTL = hasDep(ctx, "@testing-library/react");
      const hasEnzyme = hasDep(ctx, "enzyme");
      const out = [];
      if (hasEnzyme && !hasRTL) {
        out.push(
          finding(
            "react",
            "enzyme",
            "warning",
            "Uses Enzyme for component tests",
            "Enzyme has no official React 18 adapter and is effectively unmaintained.",
            { recommendation: "Migrate component tests to @testing-library/react." },
          ),
        );
      }
      if (!hasRTL && !hasEnzyme) {
        out.push(
          finding(
            "react",
            "no-component-tests",
            "info",
            "No React component testing library detected",
            "No @testing-library/react (or Enzyme) dependency was found.",
            { recommendation: "Consider @testing-library/react for component tests." },
          ),
        );
      }
      return out;
    },
  },
];
