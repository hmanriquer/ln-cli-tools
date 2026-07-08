import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";

/** Write the HTML report to disk (creating parent dirs). Returns the absolute path. */
export function writeReport(html: string, outPath: string): string {
  const abs = path.resolve(process.cwd(), outPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, html, "utf8");
  return abs;
}

/**
 * Open a file in the OS default browser, cross-platform, without a dependency.
 * Best-effort: on failure (e.g. no `xdg-open` in a headless box) it prints the
 * path so the user can open it manually — it never throws.
 */
export function openInBrowser(absPath: string): void {
  const bail = () =>
    console.error(pc.dim(`  (couldn't open a browser automatically — open ${absPath} manually)`));

  try {
    let child;
    if (process.platform === "win32") {
      // `start` is a cmd builtin; the "" is the (required) empty window-title arg.
      child = spawn("cmd", ["/c", "start", "", absPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
    } else if (process.platform === "darwin") {
      child = spawn("open", [absPath], { detached: true, stdio: "ignore" });
    } else {
      child = spawn("xdg-open", [absPath], { detached: true, stdio: "ignore" });
    }
    child.on("error", bail); // e.g. ENOENT for a missing opener — async, not thrown
    child.unref();
  } catch {
    bail();
  }
}
