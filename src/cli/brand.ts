import cfonts from "cfonts";
import pc from "picocolors";

/** Product name shown in banners and the interactive menu. */
export const APP_NAME = "Crystal Pulse";
export const AUTHOR = "by Maia Team";
export const SHORT_TAGLINE = "AI codebase health checks";
export const TAGLINE =
  "codebase health for React · Angular · Node — probes + AI";

/**
 * Big header for the interactive menu: a "block" wordmark with a cyan→magenta
 * gradient ("crystal shimmer"), CRYSTAL over PULSE, and a "by Maia Team" badge
 * to the right. Falls back to a plain colored title if cfonts can't render.
 */
export function printWordmark(): void {
  const author = pc.bold(pc.magenta(`✦ ${AUTHOR} ✦`));
  const stripAnsi = (s: string): string => s.replaceAll(/\x1b\[[0-9;]*m/g, "");
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
    if (rendered) {
      const lines = rendered.split("\n");
      const width = Math.max(0, ...lines.map((l) => stripAnsi(l).length));
      const mid = Math.floor((lines.length - 1) / 2);
      const pad = " ".repeat(
        Math.max(0, width - stripAnsi(lines[mid] ?? "").length),
      );
      lines[mid] = `${lines[mid] ?? ""}${pad}   ${author}`;
      console.log(lines.join("\n"));
    } else {
      console.log(`  ${pc.bold(pc.cyan(APP_NAME))}   ${author}`);
    }
  } catch {
    console.log(`  ${pc.bold(pc.cyan(APP_NAME))}   ${author}`);
  }
  console.log(pc.dim(`  ${TAGLINE}`));
  console.log("");
}
