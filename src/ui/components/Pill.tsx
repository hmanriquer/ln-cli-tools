import { Box, Text } from "ink";
import { COLOR } from "../theme.js";

export interface BadgeProps {
  label: string;
  color?: string;
}

/** A small colored count badge, e.g. "+3". */
export function Badge({ label, color = COLOR.ok }: BadgeProps) {
  return (
    <Text bold color={color}>
      {label}
    </Text>
  );
}

export interface PillProps {
  text: string;
  badge?: string;
  badgeColor?: string;
  borderColor?: string;
}

/** A rounded single-line highlight with an optional trailing badge. */
export function Pill({
  text,
  badge,
  badgeColor = COLOR.ok,
  borderColor = COLOR.muted,
}: PillProps) {
  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      alignSelf="flex-start"
    >
      <Text>{text}</Text>
      {badge ? (
        <Box marginLeft={1}>
          <Badge label={badge} color={badgeColor} />
        </Box>
      ) : null}
    </Box>
  );
}
