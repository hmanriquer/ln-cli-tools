/**
 * Shared visual tokens for the Ink TUI: brand + severity colors and glyphs,
 * with ASCII fallbacks when NO_UNICODE is set (or dumb terminals).
 */
import type { Severity } from "../core/types.js";

const ascii =
  process.env["NO_UNICODE"] === "1" || process.env["TERM"] === "dumb";

/** Brand gradient endpoints (cyan → magenta "crystal shimmer"). */
export const BRAND = {
  a: "#22d3ee",
  b: "#e879c9",
  gradient: ["#22d3ee", "#8b7cf6", "#e879c9"] as const,
};

export const COLOR = {
  fg: "white",
  muted: "gray",
  error: "#f87171",
  warning: "#fbbf24",
  info: "#60a5fa",
  ok: "#34d399",
  brandA: BRAND.a,
  brandB: BRAND.b,
} as const;

export const SEVERITY_COLOR: Record<Severity, string> = {
  error: COLOR.error,
  warning: COLOR.warning,
  info: COLOR.info,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

/** Glyphs with ASCII fallbacks so the UI stays legible on limited terminals. */
export const GLYPH = {
  hex: ascii ? "*" : "⬢",
  hexOutline: ascii ? "o" : "⬡",
  done: ascii ? "[x]" : "☒",
  active: ascii ? "[~]" : "▣",
  pending: ascii ? "[ ]" : "☐",
  arrow: ascii ? "->" : "→",
  star: ascii ? "*" : "✦",
  error: ascii ? "x" : "✖",
  warning: ascii ? "!" : "⚠",
  info: ascii ? "-" : "•",
  check: ascii ? "v" : "✓",
  chevron: ascii ? ">" : "›",
} as const;

export const SEVERITY_GLYPH: Record<Severity, string> = {
  error: GLYPH.error,
  warning: GLYPH.warning,
  info: GLYPH.info,
};
