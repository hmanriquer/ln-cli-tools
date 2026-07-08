import cfonts from "cfonts";
import pc from "picocolors";

/** Product name shown in banners and the interactive menu. */
export const APP_NAME = "Crystal Pulse";
export const AUTHOR = "by Maia Team";
export const SHORT_TAGLINE = "AI codebase health checks";
export const TAGLINE = "codebase health for React · Angular · Node — probes + AI";

/**
 * Big header for the interactive menu: a "block" wordmark with a cyan→magenta
 * gradient ("crystal shimmer"), CRYSTAL over PULSE, and a "by Maia Team"
 * subtitle. Falls back to a plain colored title if cfonts can't render.
 */
export function printWordmark(): void {
  console.log("");
  try {
    // "|" is a line break in cfonts → CRYSTAL on line 1, PULSE on line 2.
    const out = cfonts.render("Crystal|Pulse", {
      font: "block",
      align: "left",
      gradient: ["cyan", "magenta"],
      transitionGradient: true,
      space: false,
    });
    const rendered = out && typeof out.string === "string" ? out.string : "";
    console.log(rendered || `  ${pc.bold(pc.cyan(APP_NAME))}`);
  } catch {
    console.log(`  ${pc.bold(pc.cyan(APP_NAME))}`);
  }
  console.log(pc.dim(`  ${AUTHOR}  ·  ${TAGLINE}`));
  console.log("");
}
