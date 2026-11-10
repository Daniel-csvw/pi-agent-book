import type {
  AgentEvent,
  AgentMessage,
  ContentBlock,
  Message,
  Provider,
  StopReason,
  Tool,
} from "./types.ts";
import { runTools } from "./tools.ts";

const MAX_TOOL_ERRORS = 3;

export interface RunOptions {
  provider: Provider;
  tools: Tool[];
  messages: AgentMessage[];
  maxTurns?: number;
  /** 把 AgentMessage 投影成给模型看的 Message；E02 才传入。 */
  project?: (messages: AgentMessage[]) => Message[];
  emit?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export interface RunResult {
  messages: AgentMessage[];
  stopReason: StopReason;
  turns: number;
}

export async function runAgent(options: RunOptions): Promise<RunResult> {
  const emit = options.emit ?? (() => {});
  const project = options.project ?? ((all: AgentMessage[]) => all as Message[]);
  const maxTurns = options.maxTurns ?? 3;
  const messages = [...options.messages];
  let turns = 0;
  let stop: StopReason = "maxTurns";
  let errors = 0;

  emit({ type: "agent_start" });
  while (turns < maxTurns) {
    turns += 1;
    emit({ type: "turn_start", turn: turns });

    const content: ContentBlock[] = [];
    let reason: StopReason = "stop";
    const llm = project(messages);
    const stream = options.provider.stream(llm, options.tools, options.signal);
    for await (const chunk of stream) {
      if (chunk.type === "text") {
        content.push({ type: "text", text: chunk.text });
        emit({ type: "text_delta", text: chunk.text });
      } else if (chunk.type === "toolCall") {
        content.push({
          type: "toolCall",
          id: chunk.id,
          name: chunk.name,
          args: chunk.args,
        });
      } else {
        reason = chunk.stopReason;
      }
    }
    messages.push({ role: "assistant", content, stopReason: reason });

    const calls = content.filter((b) => b.type === "toolCall");
    if (calls.length === 0) {
      emit({ type: "turn_end", turn: turns, stopReason: reason });
      stop = reason;
      break;
    }

    const results = await runTools(calls, options.tools, emit);
    for (const result of results) {
      errors = result.isError ? errors + 1 : 0;
      messages.push({
        role: "tool",
        toolCallId: result.id,
        toolName: result.name,
        content: result.text,
        isError: result.isError,
      });
    }

    emit({ type: "turn_end", turn: turns, stopReason: reason });
    if (errors >= MAX_TOOL_ERRORS) {
      stop = "error";
      break;
    }
    if (turns >= maxTurns) {
      stop = "maxTurns";
      break;
    }
  }

  emit({ type: "agent_end", stopReason: stop });
  return { messages, stopReason: stop, turns };
}
