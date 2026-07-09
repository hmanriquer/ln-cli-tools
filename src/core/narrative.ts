/**
 * Sanitize an AI narrative for display. Some providers return the whole
 * `{ narrative, findings }` payload as text (sometimes truncated when the model
 * runs out of tokens). This pulls out just the prose — even from broken or
 * cut-off JSON — and never falls back to showing raw JSON.
 *
 * Pure module: no imports from infra/, ai/, or cli/.
 */

/**
 * Pull the `narrative` string out of a JSON-ish payload. Tries a full parse
 * first, then a tolerant regex so a truncated blob still yields clean prose.
 * Returns null if none can be recovered.
 */
function extractNarrative(jsonish: string): string | null {
  try {
    const parsed = JSON.parse(jsonish) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const narrative = (parsed as Record<string, unknown>)["narrative"];
      if (typeof narrative === "string" && narrative.trim())
        return narrative.trim();
    }
    return null;
  } catch {
    // Truncated / invalid JSON — extract the narrative string directly.
  }
  const match = /"narrative"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(jsonish);
  if (match?.[1]) {
    try {
      const decoded = JSON.parse(`"${match[1]}"`) as string;
      if (decoded.trim()) return decoded.trim();
    } catch {
      // Escaping we can't decode — better to show nothing than raw JSON.
    }
  }
  return null;
}

/**
 * Turn a raw AI narrative into clean prose. Strips ```json fences and, when the
 * text is a JSON payload, extracts just the narrative. Returns "" when there's
 * nothing presentable (so callers can hide the block entirely).
 */
export function cleanNarrative(raw: string): string {
  let text = raw.trim();
  const fence = /^```(?:json)?\n?([\s\S]*?)\n?```$/i.exec(text);
  if (fence?.[1]) text = fence[1].trim();

  if (text.startsWith("{") || text.startsWith("[")) {
    return extractNarrative(text) ?? "";
  }
  return text;
}
