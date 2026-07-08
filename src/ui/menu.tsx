import { render } from "ink";
import { MenuApp, type MenuOption } from "./apps/MenuApp.js";

export interface SelectMenuArgs {
  options: MenuOption[];
  noKeyHint?: string;
  footer?: string[];
}

/**
 * Render the Ink menu home screen and resolve with the chosen value (or null if
 * the user quit without choosing). Ink fully unmounts before this resolves, so
 * any follow-up clack prompts have exclusive control of stdin.
 */
export async function selectMenuAction(
  args: SelectMenuArgs,
): Promise<string | null> {
  let chosen: string | null = null;
  const { waitUntilExit } = render(
    <MenuApp
      options={args.options}
      noKeyHint={args.noKeyHint}
      footer={args.footer}
      onSelect={(value) => {
        chosen = value;
      }}
    />,
  );
  await waitUntilExit();
  return chosen;
}
