import { Box, Static, Text, render, useInput } from "ink";
import { Select, TextInput, PasswordInput, ProgressBar } from "@inkjs/ui";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import type { HealthReport, Severity } from "../core/types.js";
import type { PhaseEvent, RunPhase } from "../cli/commands/analyzeProject.js";
import { summarize } from "../core/report.js";
import { Wordmark } from "./components/Wordmark.js";
import { Panel } from "./components/Panel.js";
import { FooterBar } from "./components/FooterBar.js";
import { FileList } from "./components/FileList.js";
import { TaskList, type Task } from "./components/TaskList.js";
import { StatusHex } from "./components/StatusHex.js";
import { YesNoSelect } from "./components/YesNoSelect.js";
import { ReportView } from "./apps/ReportView.js";
import { COLOR, GLYPH } from "./theme.js";
import type { RunHooks, RunMeta } from "./apps/RunApp.js";

/* ------------------------------------------------------------------ store -- */

interface Frame {
  key: number;
  node: ReactElement;
}

let current: Frame | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}
function setNode(node: ReactElement | null): void {
  current = node ? { key: (seq += 1), node } : null;
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function getSnapshot(): Frame | null {
  return current;
}

/** Stable single-item list so <Static> paints the header exactly once. */
const HEADER_ITEMS: string[] = ["wordmark"];

/**
 * Persistent shell. The wordmark is painted once inside <Static> — Ink never
 * re-renders Static output, so it stays pinned on top without flickering while
 * the live body below (spinner, progress, file list) updates in place.
 */
function Shell() {
  const frame = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <Box flexDirection="column">
      <Static items={HEADER_ITEMS}>
        {(item) => (
          <Box key={item} paddingX={1} paddingTop={1}>
            <Wordmark />
          </Box>
        )}
      </Static>
      {frame ? (
        <Box key={frame.key} flexDirection="column" paddingX={1}>
          {frame.node}
        </Box>
      ) : null}
    </Box>
  );
}

/* ------------------------------------------------------------------ views -- */

export interface MenuOption {
  label: string;
  value: string;
  hint?: string;
}

function Label({ message }: { message: string }) {
  return (
    <Box>
      <Text color={COLOR.brandB}>{GLYPH.chevron} </Text>
      <Text bold>{message}</Text>
    </Box>
  );
}

function MenuView({
  options,
  noKeyHint,
  onSelect,
}: {
  options: MenuOption[];
  noKeyHint?: string;
  onSelect: (value: string | null) => void;
}) {
  useInput(
    (_, key) => {
      if (key.escape) onSelect(null);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );
  const items = options.map((o) => ({
    label: o.hint ? `${o.label}  —  ${o.hint}` : o.label,
    value: o.value,
  }));
  return (
    <Box flexDirection="column">
      {noKeyHint ? (
        <Box marginBottom={1}>
          <Panel
            title={`${GLYPH.warning} No AI credentials detected`}
            borderColor={COLOR.warning}
            titleColor={COLOR.warning}
          >
            <Text color={COLOR.muted}>{noKeyHint}</Text>
          </Panel>
        </Box>
      ) : null}
      <Box marginBottom={1}>
        <Text bold>What would you like to do?</Text>
      </Box>
      <Select options={items} onChange={(v) => onSelect(v)} />
      <FooterBar
        items={[]}
        hints={["↑↓ navigate", "enter select", "esc quit"]}
      />
    </Box>
  );
}

function SelectView({
  message,
  options,
  onDone,
}: {
  message: string;
  options: MenuOption[];
  onDone: (value: string | null) => void;
}) {
  useInput(
    (_, key) => {
      if (key.escape) onDone(null);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );
  const items = options.map((o) => ({
    label: o.hint ? `${o.label}  —  ${o.hint}` : o.label,
    value: o.value,
  }));
  return (
    <Box flexDirection="column">
      <Label message={message} />
      <Select options={items} onChange={(v) => onDone(v)} />
    </Box>
  );
}

function TextView({
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
  const [error, setError] = useState<string>();
  useInput(
    (_, key) => {
      if (key.escape) onDone(null);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );
  const submit = (raw: string): void => {
    const value = raw.trim();
    const err = validate?.(value);
    if (err) {
      setError(err);
      return;
    }
    onDone(value);
  };
  return (
    <Box flexDirection="column">
      <Label message={message} />
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

function ConfirmView({
  message,
  initial,
  onDone,
}: {
  message: string;
  initial: boolean;
  onDone: (value: boolean | null) => void;
}) {
  useInput(
    (_, key) => {
      if (key.escape) onDone(null);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );
  return (
    <Box flexDirection="column">
      <Label message={message} />
      <YesNoSelect initial={initial} onSelect={(value) => onDone(value)} />
      <FooterBar
        items={[]}
        hints={["↑↓ navigate", "enter select", "esc cancel"]}
      />
    </Box>
  );
}

function NoteView({
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
  useInput(
    (_, key) => {
      if (key.return || key.escape) onDone();
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );
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

const INITIAL_TASKS: Task[] = [
  { id: "detect", label: "Detect stacks", status: "pending" },
  { id: "probes", label: "Run probes", status: "pending" },
  { id: "ai", label: "AI investigation", status: "pending" },
  { id: "report", label: "Build report", status: "pending" },
];

const PHASE_LABEL: Record<RunPhase, string> = {
  detect: "Detecting stacks…",
  probes: "Running probes…",
  ai: "Investigating with AI…",
  report: "Building report…",
};

function toPath(line: string): string {
  const m = /^\S+\s+(.+)$/.exec(line);
  return m?.[1] ?? line;
}

function ProgressLine({ value, label }: { value: number; label: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={COLOR.muted}>{label}</Text>
      <Box>
        <Box width={34}>
          <ProgressBar value={value} />
        </Box>
        <Text color={COLOR.muted}> {value}%</Text>
      </Box>
    </Box>
  );
}

function RunView({
  meta,
  execute,
  onComplete,
  onReturn,
}: {
  meta: RunMeta;
  execute: (hooks: RunHooks) => Promise<HealthReport>;
  onComplete: (report: HealthReport) => void;
  onReturn: (report: HealthReport) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [files, setFiles] = useState<string[]>([]);
  const [status, setStatus] = useState({ label: "Starting…", done: false });
  const [expanded, setExpanded] = useState(false);
  const [report, setReport] = useState<HealthReport | null>(null);
  const started = useRef(false);
  const reportRef = useRef<HealthReport | null>(null);

  useInput(
    (input, key) => {
      if (key.ctrl && input === "r") setExpanded((v) => !v);
      if (key.return && reportRef.current) onReturn(reportRef.current);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const onPhase = (event: PhaseEvent): void => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== event.phase) return t;
          if (event.status === "start") return { ...t, status: "active" };
          return { ...t, status: "done", note: event.note };
        }),
      );
      if (event.status === "start")
        setStatus({ label: PHASE_LABEL[event.phase], done: false });
    };
    const onActivity = (line: string): void => {
      const file = toPath(line);
      setFiles((prev) =>
        (prev.includes(file) ? prev : [...prev, file]).slice(-200),
      );
    };
    execute({ onPhase, onActivity })
      .then((result) => {
        setTasks((prev) =>
          prev.map((t) => ({ ...t, status: "done" as const })),
        );
        setStatus({ label: "Analysis complete", done: true });
        reportRef.current = result;
        setReport(result);
        onComplete(result);
      })
      .catch((err: unknown) => {
        setStatus({
          label: `Failed: ${err instanceof Error ? err.message : String(err)}`,
          done: true,
        });
      });
  }, [execute, onComplete]);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progress = report ? 100 : Math.round((doneCount / tasks.length) * 100);

  if (report) {
    return (
      <Box flexDirection="column">
        <ReportView report={report} />
        <Text color={COLOR.muted}>
          {GLYPH.chevron} press enter to return to the menu
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <TaskList tasks={tasks} />
      <ProgressLine value={progress} label={status.label} />
      <Box marginTop={1}>
        <StatusHex
          label={status.label}
          active={!status.done}
          color={COLOR.brandB}
        />
      </Box>
      {files.length ? (
        <Box marginTop={1} flexDirection="column">
          <FileList files={files} expanded={expanded} />
        </Box>
      ) : null}
      <FooterBar
        items={[
          meta.provider,
          meta.model,
          meta.effort,
          files.length ? `${files.length} files read` : undefined,
        ]}
        hints={files.length > 4 ? ["ctrl+r expand"] : []}
      />
    </Box>
  );
}

interface ScanRowState {
  name: string;
  status: "pending" | "active" | "done";
  counts?: Record<Severity, number>;
}

function ScanRow({ row }: { row: ScanRowState }) {
  if (row.status === "active") {
    return <StatusHex label={row.name} active color={COLOR.brandB} />;
  }
  if (row.status === "done" && row.counts) {
    const c = row.counts;
    let color: string = COLOR.ok;
    let glyph: string = GLYPH.check;
    if (c.error) {
      color = COLOR.error;
      glyph = GLYPH.error;
    } else if (c.warning) {
      color = COLOR.warning;
      glyph = GLYPH.warning;
    }
    const parts: string[] = [];
    if (c.error) parts.push(`${c.error} err`);
    if (c.warning) parts.push(`${c.warning} warn`);
    if (c.info) parts.push(`${c.info} info`);
    return (
      <Box>
        <Text color={color}>{glyph} </Text>
        <Text color={COLOR.muted}>{row.name}</Text>
        <Text color={COLOR.muted}>
          {"  "}
          {parts.join("  ·  ") || "clean"}
        </Text>
      </Box>
    );
  }
  return (
    <Text color={COLOR.muted}>
      {GLYPH.pending} {row.name}
    </Text>
  );
}

function ScanView({
  projects,
  meta,
  runOne,
  onComplete,
  onReturn,
}: {
  projects: string[];
  meta: RunMeta;
  runOne: (index: number, hooks: RunHooks) => Promise<HealthReport>;
  onComplete: (reports: HealthReport[]) => void;
  onReturn: (reports: HealthReport[]) => void;
}) {
  const [rows, setRows] = useState<ScanRowState[]>(
    projects.map((name) => ({ name, status: "pending" })),
  );
  const [files, setFiles] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [complete, setComplete] = useState(false);
  const started = useRef(false);
  const reportsRef = useRef<HealthReport[]>([]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === "r") setExpanded((v) => !v);
      if (key.return && complete) onReturn(reportsRef.current);
    },
    { isActive: Boolean(process.stdin.isTTY) },
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const reports: HealthReport[] = [];
      for (let i = 0; i < projects.length; i += 1) {
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "active" } : r)),
        );
        setFiles([]);
        const report = await runOne(i, {
          onPhase: () => {},
          onActivity: (line) => {
            const file = toPath(line);
            setFiles((prev) =>
              (prev.includes(file) ? prev : [...prev, file]).slice(-200),
            );
          },
        });
        reports.push(report);
        const counts = summarize(report.findings);
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "done", counts } : r,
          ),
        );
      }
      reportsRef.current = reports;
      setComplete(true);
      onComplete(reports);
    })();
  }, [projects, runOne, onComplete]);

  const done = rows.filter((r) => r.status === "done").length;
  const progress = Math.round((done / Math.max(1, projects.length)) * 100);
  const totals = rows.reduce(
    (acc, r) => {
      if (r.counts) {
        acc.error += r.counts.error;
        acc.warning += r.counts.warning;
        acc.info += r.counts.info;
      }
      return acc;
    },
    { error: 0, warning: 0, info: 0 } as Record<Severity, number>,
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={COLOR.brandB}>{GLYPH.hex} </Text>
        <Text bold>Scanning</Text>
        <Text color={COLOR.muted}>
          {"  "}
          {done}/{projects.length} project{projects.length === 1 ? "" : "s"}
        </Text>
      </Box>
      <Box flexDirection="column">
        {rows.map((row) => (
          <ScanRow key={row.name} row={row} />
        ))}
      </Box>
      <ProgressLine
        value={complete ? 100 : progress}
        label={complete ? "Scan complete" : "Analyzing projects…"}
      />
      {!complete && files.length ? (
        <Box marginTop={1} flexDirection="column">
          <FileList files={files} expanded={expanded} />
        </Box>
      ) : null}
      {complete ? (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>
              {projects.length} projects{"  ·  "}
            </Text>
            <Text color={COLOR.error}>{totals.error} errors</Text>
            <Text color={COLOR.muted}>{"  ·  "}</Text>
            <Text color={COLOR.warning}>{totals.warning} warnings</Text>
            <Text color={COLOR.muted}>{"  ·  "}</Text>
            <Text color={COLOR.info}>{totals.info} info</Text>
          </Box>
          <Text color={COLOR.muted}>
            {GLYPH.chevron} press enter to return to the menu
          </Text>
        </Box>
      ) : null}
      <FooterBar
        items={[meta.provider, meta.model, meta.effort]}
        hints={files.length > 4 ? ["ctrl+r expand"] : []}
      />
    </Box>
  );
}

/* ------------------------------------------------------------------- host -- */

export interface UiHost {
  menu(args: {
    options: MenuOption[];
    noKeyHint?: string;
  }): Promise<string | null>;
  select(message: string, options: MenuOption[]): Promise<string | null>;
  text(opts: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
  }): Promise<string | null>;
  password(opts: {
    message: string;
    placeholder?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string | null>;
  confirm(message: string, initial?: boolean): Promise<boolean | null>;
  note(title: string, lines: string[], borderColor?: string): Promise<void>;
  run(
    meta: RunMeta,
    execute: (hooks: RunHooks) => Promise<HealthReport>,
    onComplete: (report: HealthReport) => void,
  ): Promise<HealthReport>;
  scan(
    projects: string[],
    meta: RunMeta,
    runOne: (index: number, hooks: RunHooks) => Promise<HealthReport>,
    onComplete: (reports: HealthReport[]) => void,
  ): Promise<HealthReport[]>;
  /** Clear the terminal and remount a fresh screen (new-session look). */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Create a persistent Ink host. One render owns the screen for the whole
 * interactive session: the wordmark stays pinned on top and every prompt,
 * panel, or run/scan view replaces the body in place (no stacking, no clutter).
 */
export function createUiHost(): UiHost {
  function mount() {
    console.clear();
    return render(<Shell />);
  }
  let instance = mount();

  return {
    menu: ({ options, noKeyHint }) =>
      new Promise((resolve) => {
        setNode(
          <MenuView
            options={options}
            noKeyHint={noKeyHint}
            onSelect={resolve}
          />,
        );
      }),
    select: (message, options) =>
      new Promise((resolve) => {
        setNode(
          <SelectView message={message} options={options} onDone={resolve} />,
        );
      }),
    text: (opts) =>
      new Promise((resolve) => {
        setNode(
          <TextView
            message={opts.message}
            placeholder={opts.placeholder}
            defaultValue={opts.defaultValue}
            onDone={resolve}
          />,
        );
      }),
    password: (opts) =>
      new Promise((resolve) => {
        setNode(
          <TextView
            message={opts.message}
            placeholder={opts.placeholder}
            mask
            validate={opts.validate}
            onDone={resolve}
          />,
        );
      }),
    confirm: (message, initial = true) =>
      new Promise((resolve) => {
        setNode(
          <ConfirmView message={message} initial={initial} onDone={resolve} />,
        );
      }),
    note: (title, lines, borderColor) =>
      new Promise((resolve) => {
        setNode(
          <NoteView
            title={title}
            lines={lines}
            borderColor={borderColor}
            onDone={resolve}
          />,
        );
      }),
    run: (meta, execute, onComplete) =>
      new Promise((resolve) => {
        setNode(
          <RunView
            meta={meta}
            execute={execute}
            onComplete={onComplete}
            onReturn={resolve}
          />,
        );
      }),
    scan: (projects, meta, runOne, onComplete) =>
      new Promise((resolve) => {
        setNode(
          <ScanView
            projects={projects}
            meta={meta}
            runOne={runOne}
            onComplete={onComplete}
            onReturn={resolve}
          />,
        );
      }),
    close: async () => {
      setNode(null);
      instance.unmount();
    },
    reset: async () => {
      // unmount() is synchronous and resolves Ink's exit promise inline; we must
      // NOT await waitUntilExit() afterwards (it lazily creates a promise that
      // never resolves once already unmounted, which would freeze the session).
      setNode(null);
      instance.unmount();
      instance = mount();
    },
  };
}
