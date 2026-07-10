import { Box, Text, useApp, useInput } from "ink";
import { ProgressBar } from "@inkjs/ui";
import { useEffect, useRef, useState } from "react";
import type { HealthReport } from "../../core/types.js";
import type {
  PhaseEvent,
  RunPhase,
} from "../../cli/commands/analyzeProject.js";
import { COLOR } from "../theme.js";
import { TaskList, type Task } from "../components/TaskList.js";
import { StatusHex } from "../components/StatusHex.js";
import { FileList } from "../components/FileList.js";
import { FooterBar } from "../components/FooterBar.js";
import { ReportView } from "./ReportView.js";

export interface RunMeta {
  provider?: string;
  model?: string;
  effort?: string;
}

export interface RunHooks {
  onPhase: (event: PhaseEvent) => void;
  onActivity: (line: string) => void;
}

export interface RunAppProps {
  meta: RunMeta;
  execute: (hooks: RunHooks) => Promise<HealthReport>;
  onDone: (report: HealthReport) => void;
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

/** Strip a leading tool verb ("read_file src/x") down to its path/argument. */
function toPath(line: string): string {
  const m = /^\S+\s+(.+)$/.exec(line);
  return m?.[1] ?? line;
}

/** The live run panel: animated checklist, hexagon status, streaming file list. */
export function RunApp({ meta, execute, onDone }: RunAppProps) {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [files, setFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<{ label: string; done: boolean }>({
    label: "Starting…",
    done: false,
  });
  const [expanded, setExpanded] = useState(false);
  const [report, setReport] = useState<HealthReport | null>(null);
  const started = useRef(false);

  useInput(
    (input, key) => {
      if (key.ctrl && input === "r") setExpanded((v) => !v);
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
      if (event.status === "start") {
        setStatus({ label: PHASE_LABEL[event.phase], done: false });
      }
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
        setReport(result);
        onDone(result);
        setTimeout(() => exit(), 40);
      })
      .catch((err: unknown) => {
        setStatus({
          label: `Failed: ${err instanceof Error ? err.message : String(err)}`,
          done: true,
        });
        setTimeout(() => exit(), 40);
      });
  }, [execute, exit, onDone]);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progress = report ? 100 : Math.round((doneCount / tasks.length) * 100);

  const footer = (
    <FooterBar
      items={[
        meta.provider,
        meta.model,
        meta.effort,
        files.length ? `${files.length} files read` : undefined,
      ]}
      hints={files.length > 4 ? ["ctrl+r expand"] : []}
    />
  );

  if (report) {
    return (
      <Box flexDirection="column">
        <ReportView report={report} />
        {footer}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <TaskList tasks={tasks} />
      <Box flexDirection="column" marginTop={1}>
        <Text color={COLOR.muted}>{status.label}</Text>
        <Box>
          <Box width={34}>
            <ProgressBar value={progress} />
          </Box>
          <Text color={COLOR.muted}> {progress}%</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <StatusHex
          label={status.label}
          active={!status.done}
          color={status.done ? COLOR.ok : COLOR.brandB}
        />
      </Box>
      {files.length ? (
        <Box marginTop={1} flexDirection="column">
          <FileList files={files} expanded={expanded} />
        </Box>
      ) : null}
      {footer}
    </Box>
  );
}
