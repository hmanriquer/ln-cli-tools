import { Box, Text, useApp } from "ink";
import { Select } from "@inkjs/ui";
import { Wordmark } from "../components/Wordmark.js";
import { Panel } from "../components/Panel.js";
import { FooterBar } from "../components/FooterBar.js";
import { COLOR, GLYPH } from "../theme.js";

export interface MenuOption {
  label: string;
  value: string;
  hint?: string;
}

export interface MenuAppProps {
  options: MenuOption[];
  noKeyHint?: string;
  footer?: string[];
  onSelect: (value: string) => void;
}

/** The interactive menu home screen: wordmark, optional warning, and a Select. */
export function MenuApp({
  options,
  noKeyHint,
  footer,
  onSelect,
}: MenuAppProps) {
  const { exit } = useApp();
  const items = options.map((o) => ({
    label: o.hint ? `${o.label}  —  ${o.hint}` : o.label,
    value: o.value,
  }));

  return (
    <Box flexDirection="column">
      <Wordmark />
      {noKeyHint ? (
        <Box marginBottom={1}>
          <Panel
            title={`${GLYPH.warning} No AI credentials detected`}
            borderColor={COLOR.warning}
            titleColor={COLOR.warning}
          >
            <Text color={COLOR.muted}>{noKeyHint}</Text>
          </Panel>
        </Box>
      ) : null}
      <Box marginBottom={1}>
        <Text bold>What would you like to do?</Text>
      </Box>
      <Select
        options={items}
        onChange={(value) => {
          onSelect(value);
          exit();
        }}
      />
      <FooterBar items={footer ?? []} hints={["↑↓ navigate", "enter select"]} />
    </Box>
  );
}
