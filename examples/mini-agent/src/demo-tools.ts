/**
 * E04 的终点：一把进程内的写锁，一次并发执行。
 * 运行：cd examples/mini-agent && node src/demo-tools.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { runTools, withFileLock, writeTool, echoTool } from "./tools.ts";
import type { ToolCallBlock } from "./types.ts";

const file = "tmp-e04.txt";
const labels = ["A", "B", "C"];
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function slowWrite(label: string): Promise<void> {
  await sleep(30);
  await writeFile(file, label, "utf8");
}

/** 三个任务同时开跑，记录各自落地时刻。 */
async function race(useLock: boolean): Promise<string> {
  const t0 = performance.now();
  const done: string[] = [];
  await Promise.all(
    labels.map(async (label) => {
      const run = () => slowWrite(label);
      if (useLock) await withFileLock(file, run);
      else await run();
      done.push(`${label}@${Math.round(performance.now() - t0)}ms`);
    }),
  );
  return done.join(" ");
}

console.log(`不加锁: ${await race(false)}`);
console.log(`加锁  : ${await race(true)}`);
console.log(`文件里最后留下: ${await readFile(file, "utf8")}`);

/* 一轮里的三个调用：一个正常、一个没有这个工具、一个参数类型不对 */
const calls: ToolCallBlock[] = [
  {
    type: "toolCall",
    id: "c1",
    name: "write",
    args: { path: file, text: "final" },
  },
  { type: "toolCall", id: "c2", name: "nope", args: {} },
  { type: "toolCall", id: "c3", name: "echo", args: { text: 42 } },
];
const outcomes = await runTools(calls, [writeTool, echoTool], () => {});
for (const out of outcomes) {
  const flag = out.isError ? "err " : "ok  ";
  console.log(`${flag} ${out.id} ${out.text}`);
}
