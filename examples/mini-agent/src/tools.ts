import { readFile, writeFile } from "node:fs/promises";
import type { AgentEvent, Tool, ToolCallBlock } from "./types.ts";

const MAX_CHARS = 4000;

export const readTool: Tool = {
  name: "read",
  description: "读一个文本文件，返回前 4000 个字符。",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "相对或绝对路径" },
    },
    required: ["path"],
  },
  async execute(args) {
    const file = String(args.path ?? "");
    if (!file) throw new Error("path 不能为空");
    const text = await readFile(file, "utf8");
    const body = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    return `# ${file}（${text.length} 字符）\n${body}`;
  },
};

export const echoTool: Tool = {
  name: "echo",
  description: "原样返回传入的 text，用来验证工具通路。",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "要回显的内容" },
    },
    required: ["text"],
  },
  execute(args) {
    return `echo: ${String(args.text ?? "")}`;
  },
};

export const writeTool: Tool = {
  name: "write",
  description: "把 text 写入 path，返回写入的字符数。",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "目标路径" },
      text: { type: "string", description: "文件内容" },
    },
    required: ["path", "text"],
  },
  async execute(args) {
    const file = String(args.path ?? "");
    if (!file) throw new Error("path 不能为空");
    const text = String(args.text ?? "");
    /* 同一路径的写排队：并发调用时后到者等前一个落盘 */
    return withFileLock(file, async () => {
      await writeFile(file, text, "utf8");
      return `wrote ${text.length} chars to ${file}`;
    });
  },
};

/** E01/E02 只用这两个；E03 才把 write 注册进来。 */
export const baseTools: Tool[] = [readTool, echoTool];

const locks = new Map<string, Promise<unknown>>();

/**
 * 同一个 key 的任务排队执行：前一个不管成功失败，后一个才开始。
 * 进程内锁，够挡住「同一轮里两个 write 抢一个文件」。
 */
export function withFileLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.catch(() => {}),
  );
  return next;
}

/** 参数校验：只查 required 与类型，不做 schema 全集。 */
export function validateArgs(
  tool: Tool,
  args: Record<string, unknown>,
): string | null {
  for (const name of tool.parameters.required) {
    if (!(name in args)) return `缺参数 ${name}`;
  }
  for (const [name, spec] of Object.entries(tool.parameters.properties)) {
    const value = args[name];
    if (value === undefined) continue;
    if (typeof value !== spec.type) {
      return `${name} 应该是 ${spec.type}，收到 ${typeof value}`;
    }
  }
  return null;
}

export interface ToolOutcome {
  id: string;
  name: string;
  text: string;
  isError: boolean;
}

/** 一轮里的所有工具调用并发跑，结果按原始顺序返回。 */
export async function runTools(
  calls: ToolCallBlock[],
  tools: Tool[],
  emit: (event: AgentEvent) => void,
): Promise<ToolOutcome[]> {
  const runOne = async (call: ToolCallBlock): Promise<ToolOutcome> => {
    const miss = (text: string): ToolOutcome => {
      emit({ type: "tool_end", id: call.id, isError: true });
      return { id: call.id, name: call.name, text, isError: true };
    };

    emit({ type: "tool_start", id: call.id, name: call.name });
    const tool = tools.find((item) => item.name === call.name);
    if (!tool) return miss(`未知工具：${call.name}`);
    const bad = validateArgs(tool, call.args);
    if (bad) return miss(bad);

    try {
      const text = await tool.execute(call.args);
      emit({ type: "tool_end", id: call.id, isError: false });
      return { id: call.id, name: call.name, text, isError: false };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      return miss(text);
    }
  };

  return Promise.all(calls.map((call) => runOne(call)));
}
