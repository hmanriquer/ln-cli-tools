import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { COLOR } from "../theme.js";

export interface FileListProps {
  files: string[];
  /** How many to show before collapsing into an "N more" line. */
  limit?: number;
  /** When true, show everything (the "expanded" state). */
  expanded?: boolean;
}

/** Dim file paths with a brief highlight flash when a new file appears. */
export function FileList({
  files,
  limit = 4,
  expanded = false,
}: FileListProps) {
  const [flash, setFlash] = useState<string | null>(null);
  const latest = files.length > 0 ? files[files.length - 1]! : null;

  useEffect(() => {
    if (!latest) return;
    setFlash(latest);
    const id = setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(id);
  }, [latest]);

  if (files.length === 0) return null;
  // Show the most recent paths so the live stream feels alive.
  const shown = expanded ? files : files.slice(-limit);
  const hidden = files.length - shown.length;

  return (
    <Box flexDirection="column">
      {shown.map((file, i) => {
        const isLatest = file === latest && i === shown.length - 1;
        const highlighted = isLatest && flash === file;
        return (
          <Text
            key={`${file}-${i}`}
            color={highlighted ? COLOR.brandA : COLOR.muted}
            bold={highlighted}
          >
            {highlighted ? "› " : "  "}
            {file}
          </Text>
        );
      })}
      {hidden > 0 ? (
        <Text color={COLOR.muted} dimColor>
          {hidden} more (ctrl+r to expand)
        </Text>
      ) : null}
    </Box>
  );
}
