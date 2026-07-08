import { Box, Text } from "ink";
import { COLOR } from "../theme.js";

export interface FileListProps {
  files: string[];
  /** How many to show before collapsing into an "N more" line. */
  limit?: number;
  /** When true, show everything (the "expanded" state). */
  expanded?: boolean;
}

/** Dim, monospace file paths with a "N more" truncation line, like the reference UI. */
export function FileList({
  files,
  limit = 4,
  expanded = false,
}: FileListProps) {
  if (files.length === 0) return null;
  const shown = expanded ? files : files.slice(0, limit);
  const hidden = files.length - shown.length;
  return (
    <Box flexDirection="column">
      {shown.map((file, i) => (
        <Text key={`${file}-${i}`} color={COLOR.muted}>
          {file}
        </Text>
      ))}
      {hidden > 0 ? (
        <Text color={COLOR.muted} dimColor>
          {hidden} more (ctrl+r to expand)
        </Text>
      ) : null}
    </Box>
  );
}
