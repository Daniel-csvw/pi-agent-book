import type { Provider } from "../types.ts";

/**
 * 假模型：不联网、不随机、不看历史的情感。
 * 规则只有三条，够把循环跑通，也够让实验刻意失败。
 *   1. 第一次调用、问句里有「读」、且 read 有描述 → 发一条 toolCall
 *   2. 已经有 tool 结果 → 回一句总结，停
 *   3. 其余 → 原样回显，停
 */
export function createMockProvider(): Provider {
  return {
    name: "mock",
    async *stream(messages, tools) {
      const last = [...messages].reverse().find((m) => m.role === "user");
      const text = last && "content" in last ? String(last.content) : "";
      const read = tools.find((t) => t.name === "read");
      const usedTool = messages.some((m) => m.role === "tool");

      const wantsRead = /读|read/i.test(text);
      if (!usedTool && read && read.description !== "" && wantsRead) {
        yield { type: "text", text: "先看看文件。" };
        yield {
          type: "toolCall",
          id: "call_1",
          name: "read",
          args: { path: "README.md" },
        };
        yield { type: "done", stopReason: "toolUse" };
        return;
      }
      if (usedTool) {
        yield { type: "text", text: "（mock）读完了，文件已经在上下文里。" };
        yield { type: "done", stopReason: "stop" };
        return;
      }
      yield { type: "text", text: `（mock）收到：${text}` };
      yield { type: "done", stopReason: "stop" };
    },
  };
}
