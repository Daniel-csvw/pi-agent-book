import type { AgentEvent, Tool, ToolCallBlock } from "./types.ts";

/** 调用前的裁决：拦下、改参数，或放行（undefined）。 */
export type BeforeVerdict =
  | { block: string }
  | { args: Record<string, unknown> }
  | undefined;

export interface ToolHooks {
  /** 校验之后、执行之前。 */
  before?(call: ToolCallBlock): BeforeVerdict;
  /** 执行之后（失败也算）。返回值就是模型看到的文本。 */
  after?(call: ToolCallBlock, text: string, isError: boolean): string;
  /** 第三道孔：事件流只读，改不了流程。 */
  onEvent?(event: AgentEvent): void;
}

/**
 * 把钩子包成一层工具表。内核（loop.ts / tools.ts）一行都不用改，
 * 因为「工具就是一个带 execute 的对象」是 E04 定下的契约。
 * 代价：包装层看不到 loop 分配的 call.id，也接不到 validateArgs。
 */
export function withHooks(tools: Tool[], hooks: ToolHooks): Tool[] {
  return tools.map((tool) => ({
    ...tool,
    async execute(args) {
      /* 借用工具名占位：这一层没有真 id */
      const call: ToolCallBlock = {
        type: "toolCall",
        id: tool.name,
        name: tool.name,
        args,
      };
      const verdict = hooks.before?.(call);
      if (verdict && "block" in verdict) throw new Error(verdict.block);
      const realArgs = verdict && "args" in verdict ? verdict.args : args;
      try {
        const text = await tool.execute(realArgs);
        return hooks.after?.(call, text, false) ?? text;
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        throw new Error(hooks.after?.(call, text, true) ?? text);
      }
    },
  }));
}
