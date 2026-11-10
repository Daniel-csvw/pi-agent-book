/**
 * 四个契约：消息、工具、事件、provider。
 * 这一层不 import 任何外部包，换 provider 也改不到它。
 */

export type StopReason = "stop" | "toolUse" | "length" | "maxTurns" | "error";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolCallBlock;

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: ContentBlock[];
  stopReason: StopReason;
}

export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
  content: string;
  isError?: boolean;
}

/** 给模型看的只有这四种。 */
export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage;

/** 只给自己看的一种：display=false 时只进上下文，不上屏。 */
export interface NoteMessage {
  role: "note";
  kind: "summary" | "reminder";
  text: string;
  display: boolean;
  timestamp: number;
}

export type AgentMessage = Message | NoteMessage;

export interface ToolParameter {
  type: "string" | "number" | "boolean";
  description: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  execute(args: Record<string, unknown>): Promise<string> | string;
}

export type ProviderChunk =
  | { type: "text"; text: string }
  | {
      type: "toolCall";
      id: string;
      name: string;
      args: Record<string, unknown>;
    }
  | { type: "done"; stopReason: StopReason };

export interface Provider {
  name: string;
  stream(
    messages: Message[],
    tools: Tool[],
    signal?: AbortSignal,
  ): AsyncIterable<ProviderChunk>;
}

export type AgentEvent =
  | { type: "agent_start" }
  | { type: "turn_start"; turn: number }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_end"; id: string; isError: boolean }
  | { type: "turn_end"; turn: number; stopReason: StopReason }
  | { type: "agent_end"; stopReason: StopReason };
