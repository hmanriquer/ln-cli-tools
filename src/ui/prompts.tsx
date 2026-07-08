import { Box, Text, render, useApp, useInput } from "ink";
import { Select, TextInput, PasswordInput, ConfirmInput } from "@inkjs/ui";
import { useState, type ReactElement } from "react";
import { COLOR, GLYPH } from "./theme.js";

/** Render an Ink prompt element and resolve once it signals completion. */
async function mountPrompt<T>(
  renderNode: (done: (value: T | null) => void) => ReactElement,
): Promise<T | null> {
  let captured: T | null = null;
  const done = (value: T | null): void => {
    captured = value;
  };
  const { waitUntilExit } = render(renderNode(done));
  await waitUntilExit();
  return captured;
}

function PromptLabel({ message }: { message: string }) {
  return (
    <Box>
      <Text color={COLOR.brandB}>{GLYPH.chevron} </Text>
      <Text bold>{message}</Text>
    </Box>
  );
}

export interface SelectPromptOption {
  label: string;
  value: string;
  hint?: string;
}

function SelectPrompt({
  message,
  options,
  onDone,
}: {
  message: string;
  options: SelectPromptOption[];
  onDone: (value: string | null) => void;
}) {
  const { exit } = useApp();
  useInput((_, key) => {
    if (key.escape) {
      onDone(null);
      exit();
    }
  });
  const items = options.map((o) => ({
    label: o.hint ? `${o.label}  —  ${o.hint}` : o.label,
    value: o.value,
  }));
  return (
    <Box flexDirection="column">
      <PromptLabel message={message} />
      <Select
        options={items}
        onChange={(value) => {
          onDone(value);
          exit();
        }}
      />
    </Box>
  );
}

/** Arrow-key single select. Resolves to the chosen value, or null if cancelled. */
export function promptSelect<T extends string>(
  message: string,
  options: SelectPromptOption[],
): Promise<T | null> {
  return mountPrompt<T>((done) => (
    <SelectPrompt
      message={message}
      options={options}
      onDone={(v) => done(v as T | null)}
    />
  ));
}

function TextPrompt({
  message,
  placeholder,
  defaultValue,
  mask,
  validate,
  onDone,
}: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  mask?: boolean;
  validate?: (value: string) => string | undefined;
  onDone: (value: string | null) => void;
}) {
  const { exit } = useApp();
  const [error, setError] = useState<string>();
  useInput((_, key) => {
    if (key.escape) {
      onDone(null);
      exit();
    }
  });
  const submit = (raw: string): void => {
    const value = raw.trim();
    const err = validate?.(value);
    if (err) {
      setError(err);
      return;
    }
    onDone(value);
    exit();
  };
  return (
    <Box flexDirection="column">
      <PromptLabel message={message} />
      <Box>
        {mask ? (
          <PasswordInput placeholder={placeholder} onSubmit={submit} />
        ) : (
          <TextInput
            placeholder={placeholder}
            defaultValue={defaultValue}
            onSubmit={submit}
          />
        )}
      </Box>
      {error ? <Text color={COLOR.error}>{error}</Text> : null}
    </Box>
  );
}

/** Free-text input. Resolves to the (trimmed) value, or null if cancelled. */
export function promptText(opts: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
}): Promise<string | null> {
  return mountPrompt<string>((done) => (
    <TextPrompt
      message={opts.message}
      placeholder={opts.placeholder}
      defaultValue={opts.defaultValue}
      onDone={done}
    />
  ));
}

/** Masked password/token input with optional validation. */
export function promptPassword(opts: {
  message: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
}): Promise<string | null> {
  return mountPrompt<string>((done) => (
    <TextPrompt
      message={opts.message}
      placeholder={opts.placeholder}
      mask
      validate={opts.validate}
      onDone={done}
    />
  ));
}

function ConfirmPrompt({
  message,
  initial,
  onDone,
}: {
  message: string;
  initial: boolean;
  onDone: (value: boolean | null) => void;
}) {
  const { exit } = useApp();
  useInput((_, key) => {
    if (key.escape) {
      onDone(null);
      exit();
    }
  });
  return (
    <Box>
      <Text color={COLOR.brandB}>{GLYPH.chevron} </Text>
      <Text bold>{message} </Text>
      <ConfirmInput
        defaultChoice={initial ? "confirm" : "cancel"}
        onConfirm={() => {
          onDone(true);
          exit();
        }}
        onCancel={() => {
          onDone(false);
          exit();
        }}
      />
    </Box>
  );
}

/** Yes/no confirmation. Resolves true/false, or null if cancelled with Esc. */
export function promptConfirm(
  message: string,
  initial = true,
): Promise<boolean | null> {
  return mountPrompt<boolean>((done) => (
    <ConfirmPrompt message={message} initial={initial} onDone={done} />
  ));
}
