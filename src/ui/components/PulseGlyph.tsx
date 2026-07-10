import { Text } from "ink";
import { COLOR, GLYPH } from "../theme.js";
import { PULSE_FRAMES, useFrames } from "../hooks/useFrames.js";

export interface PulseGlyphProps {
  /** Keep animating while true; freeze on the star when false. */
  active?: boolean;
  color?: string;
}

/** Soft brand pulse — a shimmering star that keeps the idle UI alive. */
export function PulseGlyph({
  active = true,
  color = COLOR.brandB,
}: PulseGlyphProps) {
  const frame = useFrames(PULSE_FRAMES, 280, active);
  return <Text color={color}>{active ? frame : GLYPH.star} </Text>;
}
