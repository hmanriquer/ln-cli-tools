import { Box, Text } from "ink";
import { ASCII_MODE, COLOR, GLYPH } from "../theme.js";
import {
  SPINNER_ASCII,
  SPINNER_FRAMES,
  useFrames,
} from "../hooks/useFrames.js";

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
  const frames = ASCII_MODE ? SPINNER_ASCII : SPINNER_FRAMES;
  const frame = useFrames(frames, 80, active);

  return (
    <Box>
      {active ? (
        <Text color={color}>{frame} </Text>
      ) : (
        <Text color={color}>{GLYPH.hex} </Text>
      )}
      <Text bold color={color}>
        {label}
      </Text>
    </Box>
  );
}
