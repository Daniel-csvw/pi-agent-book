/**
 * E06 的终点：跑两轮 → 关掉进程 → 重新加载，历史还在。
 * 运行：cd examples/mini-agent && node src/demo-session.ts
 */
import { appendFileSync, rmSync } from "node:fs";
import { Session } from "./session.ts";
import { runAgent } from "./loop.ts";
import { toLlm } from "./messages.ts";
import { readTool } from "./tools.ts";
import { createMockProvider } from "./provider/mock.ts";

const file = "tmp-e06.jsonl";
rmSync(file, { force: true });

const session = Session.load(file);

async function turn(input: string): Promise<void> {
  session.append({ role: "user", content: input });
  const result = await runAgent({
    provider: createMockProvider(),
    tools: [readTool],
    messages: [...session.messages],
    maxTurns: 2,
    project: toLlm,
  });
  for (const message of result.messages.slice(session.messages.length)) {
    session.append(message);
  }
}

await turn("读一下 README.md");
await turn("再说一句");
console.log(`本轮结束 ${session.messages.length} 条`);

/* 换个「进程」：只从文件读，不碰内存 */
const reloaded = Session.load(file);
const roles = reloaded.messages.map((m) => m.role).join(" > ");
console.log(`重载 ${reloaded.messages.length} 条`);
console.log(`roles: ${roles}`);

/* 坏行：文件第 7 行手动塞一句非 JSON */
appendFileSync(file, "not-json\n", "utf8");
try {
  Session.load(file);
} catch (error) {
  console.log(`ERR: ${(error as Error).message}`);
}
