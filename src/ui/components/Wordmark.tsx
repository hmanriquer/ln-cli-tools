import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { AUTHOR, TAGLINE } from "../../cli/brand.js";
import { BRAND, COLOR, GLYPH } from "../theme.js";

/**
 * Big gradient wordmark (CRYSTAL over PULSE). The byline sits to the right of
 * "Pulse" only — not vertically centered against the full two-line block.
 *
 * Fully static so it can live inside <Static> without causing flicker.
 */
export function Wordmark() {
  const colors = [...BRAND.gradient];
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Gradient colors={colors}>
        <BigText text="Crystal" font="block" space={false} />
      </Gradient>
      <Box flexDirection="row" alignItems="center">
        <Gradient colors={colors}>
          <BigText text="Pulse" font="block" space={false} />
        </Gradient>
        <Box marginLeft={2} flexDirection="row" alignItems="center">
          <Text color={COLOR.brandB}>{GLYPH.star} </Text>
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
