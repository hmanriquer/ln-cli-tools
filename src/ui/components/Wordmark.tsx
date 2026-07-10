import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { AUTHOR, TAGLINE } from "../../cli/brand.js";
import { BRAND, COLOR, GLYPH } from "../theme.js";
import { PulseGlyph } from "./PulseGlyph.js";

/** Big gradient wordmark (CRYSTAL over PULSE) with a live brand pulse badge. */
export function Wordmark() {
  const colors = [...BRAND.gradient];
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" alignItems="center">
        <Box flexDirection="column">
          <Gradient colors={colors}>
            <BigText text="Crystal" font="block" space={false} />
          </Gradient>
          <Gradient colors={colors}>
            <BigText text="Pulse" font="block" space={false} />
          </Gradient>
        </Box>
        <Box marginLeft={2} flexDirection="row" alignItems="center">
          <PulseGlyph />
          <Text bold color={COLOR.brandB}>
            {AUTHOR}
          </Text>
          <Text color={COLOR.brandB}> {GLYPH.star}</Text>
        </Box>
      </Box>
      <Text color={COLOR.muted}>{TAGLINE}</Text>
    </Box>
  );
}
