import path from "node:path";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import type { HealthReport, Severity } from "../../core/types.js";
import { summarize } from "../../core/report.js";
import { cleanNarrative } from "../../core/narrative.js";
import { buildFixPrompt } from "../../core/fixPrompt.js";
import { copyToClipboard } from "../../infra/clipboard.js";
import { COLOR, GLYPH, SEVERITY_LABEL } from "../theme.js";
import { FindingCard } from "../components/FindingCard.js";
import { VerdictBar } from "../components/VerdictBar.js";
import { Panel } from "../components/Panel.js";

const ORDER: Severity[] = ["error", "warning", "info"];
const PREVIEW_LINES = 8;

/** Full findings report for a single project, rendered in the TUI. */
export function ReportView({ report }: { report: HealthReport }) {
  const counts = summarize(report.findings);
  const name = path.basename(report.root) || report.root;
  const fixPrompt = buildFixPrompt(report, name);
  const narrative = report.ai?.narrative
    ? cleanNarrative(report.ai.narrative)
    : "";
  const grouped = ORDER.map((sev) => ({
    sev,
    items: report.findings.filter((f) => f.severity === sev),
  }));
  const [copied, setCopied] = useState<boolean | null>(null);

  useEffect(() => {
    if (!fixPrompt) return;
    let cancelled = false;
    void copyToClipboard(fixPrompt).then((ok) => {
      if (!cancelled) setCopied(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [fixPrompt]);

  const preview = fixPrompt
    ? (() => {
        const lines = fixPrompt.split("\n");
        const head = lines.slice(0, PREVIEW_LINES).join("\n");
        return lines.length > PREVIEW_LINES ? `${head}\n…` : head;
      })()
    : "";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={COLOR.muted}>target </Text>
        <Text>{report.root}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={COLOR.muted}>stacks </Text>
        <Text>{report.stacks.join(", ") || "unknown"}</Text>
      </Box>

      {fixPrompt ? (
        <Box marginBottom={1} flexDirection="column">
          <Panel
            title="Fix prompt"
            titleColor={COLOR.brandB}
            borderColor={COLOR.brandB}
          >
            <Text color={COLOR.muted}>{preview}</Text>
          </Panel>
          <Box marginTop={0}>
            <Text color={copied === true ? COLOR.ok : COLOR.muted}>
              {copied === true
                ? `${GLYPH.check} copied to clipboard`
                : copied === false
                  ? "could not copy — select the prompt above"
                  : "copying…"}
            </Text>
          </Box>
          <Text color="#d97757">
            ✳ Open in Claude Code{" "}
            <Text color={COLOR.muted}>· coming soon</Text>
          </Text>
        </Box>
      ) : null}

      {report.findings.length === 0 ? (
        <Text color={COLOR.ok}>No findings — looks healthy.</Text>
      ) : (
        grouped.map(({ sev, items }) =>
          items.length ? (
            <Box key={sev} flexDirection="column" marginBottom={1}>
              <Text bold color={COLOR[sev]}>
                {SEVERITY_LABEL[sev]}s ({items.length})
              </Text>
              {items.map((f, i) => (
                <FindingCard key={`${sev}-${i}`} finding={f} />
              ))}
            </Box>
          ) : null,
        )
      )}

      {narrative ? (
        <Box marginBottom={1}>
          <Panel
            title="AI summary"
            titleColor={COLOR.info}
            borderColor={COLOR.info}
          >
            <Text>{narrative}</Text>
          </Panel>
        </Box>
      ) : report.ai?.skipped ? (
        <Text color={COLOR.muted}>
          AI analysis skipped: {report.ai.skipped}
        </Text>
      ) : null}

      <VerdictBar counts={counts} />
    </Box>
  );
}
