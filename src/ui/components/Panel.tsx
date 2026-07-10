import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { COLOR } from "../theme.js";

export interface PanelProps {
  title?: string;
  titleColor?: string;
  borderColor?: string;
  children: ReactNode;
  /** Compact panels drop the vertical padding. */
  dense?: boolean;
}

/** A rounded, framed panel — the base container that echoes the reference UI. */
export function Panel({
  title,
  titleColor = COLOR.fg,
  borderColor = COLOR.muted,
  children,
  dense = false,
}: PanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={dense ? 0 : undefined}
    >
      {title ? (
        <Text bold color={titleColor}>
          {title}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}
