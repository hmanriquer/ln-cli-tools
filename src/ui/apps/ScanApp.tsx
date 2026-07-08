import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import { useEffect, useRef, useState } from "react";
import type { HealthReport, Severity } from "../../core/types.js";
import { summarize } from "../../core/report.js";
import { COLOR, GLYPH } from "../theme.js";
import { FileList } from "../components/FileList.js";
import { FooterBar } from "../components/FooterBar.js";
import type { RunHooks, RunMeta } from "./RunApp.js";

type RowStatus = "pending" | "active" | "done";

interface Row {
  name: string;
  status: RowStatus;
  counts?: Record<Severity, number>;
}

function countLabel(c: Record<Severity, number>): string {
  const parts: string[] = [];
  if (c.error) parts.push(`${c.error} err`);
  if (c.warning) parts.push(`${c.warning} warn`);
  if (c.info) parts.push(`${c.info} info`);
  return parts.join("  ·  ") || "clean";
}

function ProjectRow({ row }: { row: Row }) {
  if (row.status === "active") {
    return (
      <Box>
        <Box marginRight={1}>
          <Spinner />
        </Box>
        <Text bold>{row.name}</Text>
      </Box>
    );
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
    return (
      <Box>
        <Text color={color}>{glyph} </Text>
        <Text color={COLOR.muted}>{row.name}</Text>
        <Text color={COLOR.muted}>
          {"  "}
          {countLabel(c)}
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

export interface ScanAppProps {
  projects: string[];
  meta: RunMeta;
  runOne: (index: number, hooks: RunHooks) => Promise<HealthReport>;
  onDone: (reports: HealthReport[]) => void;
}

/** Live multi-project scan panel: per-project status rows + current activity. */
export function ScanApp({ projects, meta, runOne, onDone }: ScanAppProps) {
  const { exit } = useApp();
  const [rows, setRows] = useState<Row[]>(
    projects.map((name) => ({ name, status: "pending" as const })),
  );
  const [files, setFiles] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [complete, setComplete] = useState(false);
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
            const m = /^\S+\s+(.+)$/.exec(line);
            const file = m?.[1] ?? line;
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
      setComplete(true);
      onDone(reports);
      setTimeout(() => exit(), 40);
    })();
  }, [projects, runOne, onDone, exit]);

  const done = rows.filter((r) => r.status === "done").length;
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
          <ProjectRow key={row.name} row={row} />
        ))}
      </Box>

      {!complete && files.length ? (
        <Box marginTop={1} flexDirection="column">
          <FileList files={files} expanded={expanded} />
        </Box>
      ) : null}

      {complete ? (
        <Box marginTop={1}>
          <Text bold>
            {projects.length} projects{"  ·  "}
          </Text>
          <Text color={COLOR.error}>{totals.error} errors</Text>
          <Text color={COLOR.muted}>{"  ·  "}</Text>
          <Text color={COLOR.warning}>{totals.warning} warnings</Text>
          <Text color={COLOR.muted}>{"  ·  "}</Text>
          <Text color={COLOR.info}>{totals.info} info</Text>
        </Box>
      ) : null}

      <FooterBar
        items={[meta.provider, meta.model, meta.effort]}
        hints={files.length > 4 ? ["ctrl+r expand"] : []}
      />
    </Box>
  );
}
