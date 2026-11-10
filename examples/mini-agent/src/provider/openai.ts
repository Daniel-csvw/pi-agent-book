import type {
  Message,
  Provider,
  ProviderChunk,
  StopReason,
  Tool,
} from "../types.ts";

export interface OpenAIOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

/** tool_calls 分片暂存：id 只来一次，name 与 args 可能来好几段。 */
interface PendingCall {
  id: string;
  name: string;
  args: string;
}

function wireMessages(messages: Message[]) {
  return messages.map((message) => {
    if (message.role === "system" || message.role === "user") {
      return { role: message.role, content: message.content };
    }
    if (message.role === "assistant") {
      const text = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      const calls = message.content
        .filter((block) => block.type === "toolCall")
        .map((block) => ({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.args),
          },
        }));
      if (calls.length > 0) {
        return { role: "assistant", content: text || null, tool_calls: calls };
      }
      return { role: "assistant", content: text };
    }
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  });
}

function mapReason(reason: string | null | undefined): StopReason {
  if (reason === "tool_calls") return "toolUse";
  if (reason === "length") return "length";
  return "stop";
}

/** 真模型：只有一个 POST，流式读 SSE，边读边翻译成 chunk。 */
export function createOpenAIProvider(options: OpenAIOptions = {}): Provider {
  const env = process.env.OPENAI_BASE_URL ?? "";
  const baseUrl = (options.baseUrl ?? env).replace(/\/$/, "");
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  return {
    name: "openai",
    async *stream(messages, tools, signal) {
      if (!baseUrl || !apiKey) {
        throw new Error("缺 OPENAI_BASE_URL 或 OPENAI_API_KEY");
      }
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: wireMessages(messages),
          tools: tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
        }),
      });
      if (!response.ok || !response.body) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const pending = new Map<number, PendingCall>();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            const data = line.startsWith("data:") ? line.slice(5).trim() : "";
            if (!data || data === "[DONE]") continue;
            const event = JSON.parse(data);
            const choice = event.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta ?? {};
            if (delta.content) {
              yield { type: "text", text: delta.content } as ProviderChunk;
            }
            for (const call of delta.tool_calls ?? []) {
              const index = call.index ?? 0;
              const slot =
                pending.get(index) ?? { id: "", name: "", args: "" };
              if (call.id) slot.id = call.id;
              if (call.function?.name) slot.name += call.function.name;
              if (call.function?.arguments) {
                slot.args += call.function.arguments;
              }
              pending.set(index, slot);
            }
            if (choice.finish_reason) {
              for (const [index, slot] of pending) {
                let args: Record<string, unknown> = {};
                try {
                  args = JSON.parse(slot.args) as Record<string, unknown>;
                } catch {
                  args = { _raw: slot.args };
                }
                yield {
                  type: "toolCall",
                  id: slot.id || `call_${index}`,
                  name: slot.name,
                  args,
                } as ProviderChunk;
              }
              pending.clear();
              const stopReason = mapReason(choice.finish_reason);
              yield { type: "done", stopReason } as ProviderChunk;
            }
          }
        }
      }
    },
  };
}

export type { Tool };
