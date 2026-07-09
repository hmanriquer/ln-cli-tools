import { Box, Text } from "ink";
import type { HealthReport, Severity } from "../../core/types.js";
import { summarize } from "../../core/report.js";
import { cleanNarrative } from "../../core/narrative.js";
import { COLOR, SEVERITY_LABEL } from "../theme.js";
import { FindingCard } from "../components/FindingCard.js";
import { VerdictBar } from "../components/VerdictBar.js";
import { Panel } from "../components/Panel.js";

const ORDER: Severity[] = ["error", "warning", "info"];

/** Full findings report for a single project, rendered in the TUI. */
export function ReportView({ report }: { report: HealthReport }) {
  const counts = summarize(report.findings);
  const narrative = report.ai?.narrative
    ? cleanNarrative(report.ai.narrative)
    : "";
  const grouped = ORDER.map((sev) => ({
    sev,
    items: report.findings.filter((f) => f.severity === sev),
  }));

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
