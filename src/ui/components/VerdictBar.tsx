import { Box, Text } from "ink";
import type { Severity } from "../../core/types.js";
import { COLOR, GLYPH } from "../theme.js";

export interface VerdictBarProps {
  counts: Record<Severity, number>;
}

/** Final summary strip: counts + a color-coded verdict, in a rounded panel. */
export function VerdictBar({ counts }: VerdictBarProps) {
  const parts: string[] = [];
  if (counts.error)
    parts.push(`${counts.error} error${counts.error > 1 ? "s" : ""}`);
  if (counts.warning)
    parts.push(`${counts.warning} warning${counts.warning > 1 ? "s" : ""}`);
  if (counts.info) parts.push(`${counts.info} info`);

  let color: string = COLOR.ok;
  let verdict = `${GLYPH.check} looks healthy`;
  if (counts.error > 0) {
    color = COLOR.error;
    verdict = `${GLYPH.error} action needed — errors present`;
  } else if (counts.warning > 0) {
    color = COLOR.warning;
    verdict = `${GLYPH.warning} review recommended`;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      alignSelf="flex-start"
    >
      <Text color={COLOR.muted}>
        {parts.length ? parts.join(`  ${GLYPH.chevron}  `) : "clean"}
      </Text>
      <Text bold color={color}>
        {verdict}
      </Text>
    </Box>
  );
}
