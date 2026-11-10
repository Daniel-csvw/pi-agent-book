import { readFile, writeFile } from "node:fs/promises";
import type { Tool } from "./types.ts";

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
    await writeFile(file, text, "utf8");
    return `wrote ${text.length} chars to ${file}`;
  },
};

/** E01/E02 只用这两个；E03 才把 write 注册进来。 */
export const baseTools: Tool[] = [readTool, echoTool];
