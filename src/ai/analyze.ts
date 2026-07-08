import type Anthropic from "@anthropic-ai/sdk";
import { MAX_AI_ITERATIONS, MAX_TOKENS, type Effort } from "../config.js";
import type { Finding, Stack } from "../core/types.js";
import { analysisTools, executeTool } from "./tools.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt.js";
import { toAiResult, type AiResult } from "./result.js";

export type { AiResult } from "./result.js";

export interface AnalyzeOptions {
  client: Anthropic;
  root: string;
  model: string;
  effort: Effort;
  stacks: Stack[];
  probeFindings: Finding[];
  rootEntries: string[];
  /** Optional progress hook, called with a short line per tool call. */
  onActivity?: (line: string) => void;
}

/**
 * Agentic, read-only analysis loop. Claude investigates with the read tools and
 * terminates by calling `submit_findings`. Streaming keeps long turns under the
 * request timeout; adaptive thinking + high effort by default.
 */
export async function analyze(opts: AnalyzeOptions): Promise<AiResult> {
  const { client, root, model, effort, stacks, probeFindings, rootEntries, onActivity } = opts;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(stacks, probeFindings, rootEntries) },
  ];

  for (let iteration = 0; iteration < MAX_AI_ITERATIONS; iteration += 1) {
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: { effort },
      tools: analysisTools,
      messages,
    });

    const message = await stream.finalMessage();
    messages.push({ role: "assistant", content: message.content });

    // Server-side pause (e.g. long tool-less turn): re-send to resume.
    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { findings: [], narrative: text || undefined };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let submitted: AiResult | null = null;

    for (const tu of toolUses) {
      if (tu.name === "submit_findings") {
        submitted = toAiResult(tu.input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "Recorded." });
        continue;
      }
      onActivity?.(describeToolCall(tu));
      const output = await executeTool(root, tu.name, tu.input);
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: output });
    }

    if (submitted) return submitted;

    messages.push({ role: "user", content: toolResults });
  }

  return {
    findings: [],
    narrative: "Analysis stopped after reaching the iteration limit before submitting findings.",
  };
}

function describeToolCall(tu: Anthropic.ToolUseBlock): string {
  const input = (tu.input ?? {}) as Record<string, unknown>;
  const arg =
    (typeof input["path"] === "string" && input["path"]) ||
    (typeof input["pattern"] === "string" && input["pattern"]) ||
    "";
  return arg ? `${tu.name} ${arg}` : tu.name;
}
