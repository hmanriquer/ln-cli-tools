import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { COLOR, GLYPH } from "../theme.js";

export type TaskStatus = "pending" | "active" | "done";

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  /** Optional short note shown after the label (e.g. a count). */
  note?: string;
}

function TaskRow({ task }: { task: Task }) {
  if (task.status === "active") {
    return (
      <Box>
        <Box marginRight={1}>
          <Spinner />
        </Box>
        <Text bold color={COLOR.fg}>
          {task.label}
        </Text>
        {task.note ? <Text color={COLOR.muted}> {task.note}</Text> : null}
      </Box>
    );
  }
  if (task.status === "done") {
    return (
      <Box>
        <Text color={COLOR.ok}>{GLYPH.done} </Text>
        <Text color={COLOR.muted}>{task.label}</Text>
        {task.note ? <Text color={COLOR.muted}> {task.note}</Text> : null}
      </Box>
    );
  }
  return (
    <Box>
      <Text color={COLOR.muted}>
        {GLYPH.pending} {task.label}
      </Text>
    </Box>
  );
}

/** The animated to-do checklist that drives the run experience. */
export function TaskList({ tasks }: { tasks: Task[] }) {
  const remaining = tasks.filter((t) => t.status !== "done").length;
  return (
    <Box flexDirection="column">
      <Box marginBottom={0}>
        <Text color={COLOR.brandB}>{GLYPH.hex} </Text>
        <Text bold>Working</Text>
        <Text color={COLOR.muted}>
          {" "}
          on {remaining} to-do{remaining === 1 ? "" : "s"}
        </Text>
      </Box>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </Box>
  );
}
