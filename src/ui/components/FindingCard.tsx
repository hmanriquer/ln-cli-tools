import { Box, Text } from "ink";
import type { Finding } from "../../core/types.js";
import {
  COLOR,
  GLYPH,
  SEVERITY_COLOR,
  SEVERITY_GLYPH,
  SEVERITY_LABEL,
} from "../theme.js";

/** A single finding rendered as a severity-accented card. */
export function FindingCard({ finding }: { finding: Finding }) {
  const color = SEVERITY_COLOR[finding.severity];
  const tag = finding.source === "ai" ? "AI" : "probe";
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={color}>{SEVERITY_GLYPH[finding.severity]} </Text>
        <Text bold>{finding.title}</Text>
        <Box marginLeft={1}>
          <Text color={color}>[{SEVERITY_LABEL[finding.severity]}]</Text>
        </Box>
        <Box marginLeft={1}>
          <Text color={COLOR.muted}>({tag})</Text>
        </Box>
      </Box>
      {finding.file ? (
        <Text color={COLOR.muted}>
          {"  "}
          {finding.file}
        </Text>
      ) : null}
      {finding.detail ? (
        <Text>
          {"  "}
          {finding.detail}
        </Text>
      ) : null}
      {finding.recommendation ? (
        <Text color={COLOR.ok}>
          {"  "}
          {GLYPH.arrow} {finding.recommendation}
        </Text>
      ) : null}
    </Box>
  );
}
