import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { COLOR, GLYPH } from "../theme.js";

export interface YesNoSelectProps {
  /** Default selection. */
  initial?: boolean;
  onSelect: (value: boolean) => void;
  /** Optional hint labels under each choice. */
  yesHint?: string;
  noHint?: string;
}

/**
 * Arrow-key Yes / No selector — a professional alternative to typing Y/N.
 * ↑↓ or ←→ to move, Enter to confirm.
 */
export function YesNoSelect({
  initial = true,
  onSelect,
  yesHint,
  noHint,
}: YesNoSelectProps) {
  const [choice, setChoice] = useState(initial);

  useInput(
    (_input, key) => {
      if (key.upArrow || key.leftArrow) setChoice(true);
      if (key.downArrow || key.rightArrow) setChoice(false);
      if (key.return) onSelect(choice);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );

  return (
    <Box flexDirection="column" marginLeft={2}>
      <ChoiceRow
        selected={choice === true}
        label="Yes"
        hint={yesHint}
      />
      <ChoiceRow
        selected={choice === false}
        label="No"
        hint={noHint}
      />
    </Box>
  );
}

function ChoiceRow({
  selected,
  label,
  hint,
}: {
  selected: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <Box>
      <Text color={selected ? COLOR.brandB : COLOR.muted}>
        {selected ? `${GLYPH.arrow} ` : "  "}
      </Text>
      <Text bold={selected} color={selected ? COLOR.fg : COLOR.muted}>
        {label}
      </Text>
      {hint ? (
        <Text color={COLOR.muted}>
          {"  —  "}
          {hint}
        </Text>
      ) : null}
    </Box>
  );
}
