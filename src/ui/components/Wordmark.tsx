import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { AUTHOR, TAGLINE } from "../../cli/brand.js";
import { BRAND, COLOR, GLYPH } from "../theme.js";

/** Big gradient wordmark (CRYSTAL over PULSE) with the byline badge to the right. */
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
        <Box marginLeft={2}>
          <Text bold color={COLOR.brandB}>
            {GLYPH.star} {AUTHOR} {GLYPH.star}
          </Text>
        </Box>
      </Box>
      <Text color={COLOR.muted}>{TAGLINE}</Text>
    </Box>
  );
}
