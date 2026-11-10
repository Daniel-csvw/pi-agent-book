/**
 * E07 的终点：拦一个、改一个、记一笔，内核一行没改。
 * 运行：cd examples/mini-agent && node src/demo-hooks.ts
 */
import { existsSync, rmSync } from "node:fs";
import { withHooks } from "./hooks.ts";
import type { ToolHooks } from "./hooks.ts";
import { runAgent } from "./loop.ts";
import { toLlm } from "./messages.ts";
import { echoTool, writeTool } from "./tools.ts";
import type { Provider } from "./types.ts";

const target = "tmp-e07-secret.txt";
rmSync(target, { force: true });

/* 剧本模型：第一轮发两个调用，第二轮收尾。真模型做不到这么可控。 */
const scripted: Provider = {
  name: "scripted",
  async *stream(messages) {
    if (messages.some((m) => m.role === "tool")) {
      yield { type: "text", text: "两个都试过了。" };
      yield { type: "done", stopReason: "stop" };
      return;
    }
    yield { type: "toolCall", id: "c1", name: "echo", args: { text: "原始" } };
    yield {
      type: "toolCall",
      id: "c2",
      name: "write",
      args: { path: target, text: "x" },
    };
    yield { type: "done", stopReason: "toolUse" };
  },
};

const hooks: ToolHooks = {
  before(call) {
    if (call.name === "write" && String(call.args.path).includes("secret")) {
      return { block: "不许写 secret" };
    }
    if (call.name === "echo") return { args: { text: "被钩子改写" } };
    return undefined;
  },
  after(_call, text, isError) {
    return isError ? text : `${text} [审计]`;
  },
  onEvent(event) {
    if (event.type === "turn_end") {
      console.log(`turn ${event.turn} end ${event.stopReason}`);
    }
  },
};

const result = await runAgent({
  provider: scripted,
  tools: withHooks([echoTool, writeTool], hooks),
  messages: [{ role: "user", content: "试试工具" }],
  maxTurns: 3,
  project: toLlm,
  emit: (event) => hooks.onEvent?.(event),
});

for (const message of result.messages) {
  if (message.role !== "tool") continue;
  const flag = message.isError ? "err " : "ok  ";
  console.log(`${flag}${message.toolCallId} ${message.content}`);
}
console.log(`secret 文件被写了吗: ${existsSync(target)}`);
