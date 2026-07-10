import { useEffect, useState } from "react";

/**
 * Cycle through `frames` on an interval. Returns the current frame string.
 * Stops updating when `active` is false (keeps the last frame).
 */
export function useFrames(
  frames: readonly string[],
  intervalMs = 120,
  active = true,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || frames.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, frames, intervalMs]);

  return frames[index % frames.length] ?? frames[0] ?? "";
}

/** Soft brand pulse: cycles a glyph through dim → bright → dim. */
export const PULSE_FRAMES = ["·", "✦", "✧", "✦"] as const;

/** Soft breathing chevron for idle prompts. */
export const CHEVRON_FRAMES = ["›", "·", "›", " "] as const;
