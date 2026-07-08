import { Box, Text } from "ink";
import { COLOR, GLYPH } from "../theme.js";

export interface FooterBarProps {
  /** Ordered metadata segments, joined with " · ". Falsy entries are dropped. */
  items: Array<string | false | undefined | null>;
  /** Optional right-aligned hint segments (e.g. keyboard shortcuts). */
  hints?: Array<string | false | undefined | null>;
}

/** Dim status bar: "provider · model · effort · … · ↓ to review". */
export function FooterBar({ items, hints }: FooterBarProps) {
  const left = items.filter((v): v is string => Boolean(v));
  const right = (hints ?? []).filter((v): v is string => Boolean(v));
  return (
    <Box marginTop={1} flexDirection="row">
      <Text color={COLOR.muted}>{left.join(`  ${GLYPH.chevron}  `)}</Text>
      {right.length ? (
        <Text color={COLOR.muted} dimColor>
          {"   "}
          {right.join("   ")}
        </Text>
      ) : null}
    </Box>
  );
}
