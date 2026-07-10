import { Box, Text, render, useApp, useInput } from "ink";
import pc from "picocolors";
import { Panel } from "./components/Panel.js";
import { COLOR, GLYPH } from "./theme.js";

/** One-off status lines (fire-and-forget, no Ink mount needed). */
export function logSuccess(message: string): void {
  console.log(`${pc.green(GLYPH.check)} ${message}`);
}
export function logInfo(message: string): void {
  console.log(`${pc.cyan(GLYPH.info)} ${message}`);
}
export function logWarn(message: string): void {
  console.log(`${pc.yellow(GLYPH.warning)} ${message}`);
}
export function logError(message: string): void {
  console.log(`${pc.red(GLYPH.error)} ${message}`);
}

function PanelView({
  title,
  lines,
  borderColor,
  onDone,
}: {
  title: string;
  lines: string[];
  borderColor?: string;
  onDone: () => void;
}) {
  const { exit } = useApp();
  useInput((_, key) => {
    if (key.return || key.escape) {
      onDone();
      exit();
    }
  });
  return (
    <Box flexDirection="column">
      <Panel title={title} borderColor={borderColor}>
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Panel>
      <Text color={COLOR.muted}>{GLYPH.chevron} press enter to continue</Text>
    </Box>
  );
}

/** Render a framed info panel and wait for Enter/Esc before returning. */
export async function showPanel(
  title: string,
  lines: string[],
  borderColor?: string,
): Promise<void> {
  const { waitUntilExit } = render(
    <PanelView
      title={title}
      lines={lines}
      borderColor={borderColor}
      onDone={() => {}}
    />,
  );
  await waitUntilExit();
}
