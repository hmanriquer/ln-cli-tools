import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { COLOR, GLYPH } from "../theme.js";

export interface StatusHexProps {
  label: string;
  color?: string;
  /** Show an animated spinner instead of a static hexagon. */
  active?: boolean;
}

/** A colored hexagon status line (e.g. "⬢ Analyzing…"), optionally animated. */
export function StatusHex({
  label,
  color = COLOR.ok,
  active = true,
}: StatusHexProps) {
  return (
    <Box>
      {active ? (
        <Box marginRight={1}>
          <Spinner />
        </Box>
      ) : (
        <Text color={color}>{GLYPH.hex} </Text>
      )}
      <Text bold color={color}>
        {label}
      </Text>
    </Box>
  );
}
