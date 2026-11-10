/**
 * E01 的终点：把四块拼起来，跑通一条完整链路。
 * 运行：cd examples/mini-agent && node src/demo.ts
 */
import { readFile } from "node:fs/promises";
import { runAgent } from "./loop.ts";
import { createMockProvider } from "./provider/mock.ts";
import type { AgentEvent, Tool } from "./types.ts";

/**
 * 工具就是这个形状：名字 + 描述 + 参数表 + 一个函数。
 * 描述不是给人看的，是给模型看的——mock 也照着它决定要不要调用。
 */
const read: Tool = {
  name: "read",
  description: "读一个文本文件的前 5 行",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "相对路径" } },
    required: ["path"],
  },
  async execute(args) {
    const text = await readFile(String(args.path), "utf8");
    return text.split("\n").slice(0, 5).join("\n");
  },
};

/** 事件是给人看的：循环自己不 print，谁消费谁决定怎么显示。 */
function trace(event: AgentEvent): void {
  switch (event.type) {
    case "turn_start":
      process.stdout.write(`\n[turn ${event.turn}] `);
      break;
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "tool_start":
      process.stdout.write(`\n  -> ${event.name} `);
      break;
    case "tool_end":
      process.stdout.write(event.isError ? "[err]" : "[ok]");
      break;
    case "agent_end":
      process.stdout.write(`\n[${event.stopReason}] `);
      break;
    default:
      break;
  }
}

const result = await runAgent({
  provider: createMockProvider(),
  tools: [read],
  messages: [{ role: "user", content: "读一下 README.md 的头几行" }],
  maxTurns: 3,
  emit: trace,
});

console.log(`turns=${result.turns} stop=${result.stopReason}`);
console.log(`roles: ${result.messages.map((m) => m.role).join(" → ")}`);
