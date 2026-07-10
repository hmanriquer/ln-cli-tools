import { Text } from "ink";
import { ASCII_MODE, COLOR, GLYPH } from "../theme.js";
import { CHEVRON_FRAMES, useFrames } from "../hooks/useFrames.js";

export interface BreathingChevronProps {
  color?: string;
  active?: boolean;
}

/** Soft pulsing chevron for idle prompt labels — keeps waiting UI alive. */
export function BreathingChevron({
  color = COLOR.brandB,
  active = true,
}: BreathingChevronProps) {
  const frames = ASCII_MODE ? ([">", ".", ">", " "] as const) : CHEVRON_FRAMES;
  const frame = useFrames(frames, 480, active);
  return (
    <Text color={color}>{active ? frame : GLYPH.chevron} </Text>
  );
}
