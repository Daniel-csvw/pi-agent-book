import { readFileSync } from "node:fs";
import type { Provider, ProviderChunk, StopReason } from "../types.ts";

/** finish_reason 的四种值 → 我们的五种 stopReason。 */
function mapReason(reason: string | null | undefined): StopReason {
  if (reason === "tool_calls") return "toolUse";
  if (reason === "length") return "length";
  return "stop";
}

/**
 * 把录下来的一份 OpenAI SSE 回复重放成 chunk。
 * 录制文件一行一个 data:，最后一行 data: [DONE]。
 */
export function createFixtureProvider(file: string): Provider {
  const chunks = loadChunks(file);
  return {
    name: "fixture",
    async *stream() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

export function loadChunks(file: string): ProviderChunk[] {
  const raw = readFileSync(file, "utf8");
  const chunks: ProviderChunk[] = [];
  const pending = new Map<number, { id: string; name: string; args: string }>();

  for (const line of raw.split(/\r?\n/)) {
    const data = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
    if (!data || data === "[DONE]") continue;
    let event: {
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finish_reason?: string | null;
      }>;
    };
    try {
      event = JSON.parse(data);
    } catch {
      throw new Error(`${file} 里有一行不是 JSON：${data.slice(0, 40)}`);
    }
    const choice = event.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta ?? {};
    if (delta.content) chunks.push({ type: "text", text: delta.content });
    for (const call of delta.tool_calls ?? []) {
      const index = call.index ?? 0;
      const slot = pending.get(index) ?? { id: "", name: "", args: "" };
      if (call.id) slot.id = call.id;
      if (call.function?.name) slot.name += call.function.name;
      if (call.function?.arguments) slot.args += call.function.arguments;
      pending.set(index, slot);
    }
    if (choice.finish_reason) {
      for (const [index, slot] of [...pending.entries()].sort((a, b) => a[0] - b[0])) {
        chunks.push({
          type: "toolCall",
          id: slot.id || `call_${index}`,
          name: slot.name,
          args: parseArgs(slot.args),
        });
      }
      pending.clear();
      chunks.push({ type: "done", stopReason: mapReason(choice.finish_reason) });
    }
  }
  return chunks;
}

function parseArgs(text: string): Record<string, unknown> {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { _raw: text };
  }
}
