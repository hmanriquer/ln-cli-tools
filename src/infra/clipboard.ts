import { spawn } from "node:child_process";

/**
 * Copy text to the system clipboard. Returns true on success, false on failure
 * (never throws — callers can still print the text for manual copy).
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === "win32") {
      cmd = "clip";
      args = [];
    } else if (platform === "darwin") {
      cmd = "pbcopy";
      args = [];
    } else {
      // Prefer Wayland, then X11.
      cmd = "wl-copy";
      args = [];
    }

    const trySpawn = (command: string, commandArgs: string[]): void => {
      const child = spawn(command, commandArgs, {
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true,
      });
      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      child.on("error", () => {
        if (platform === "linux" && command === "wl-copy") {
          trySpawn("xclip", ["-selection", "clipboard"]);
          return;
        }
        finish(false);
      });
      child.on("close", (code) => finish(code === 0));
      child.stdin.on("error", () => finish(false));
      child.stdin.end(text, "utf8");
    };

    trySpawn(cmd, args);
  });
}
