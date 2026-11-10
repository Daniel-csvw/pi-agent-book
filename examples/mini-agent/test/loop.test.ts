import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgent } from "../src/loop.ts";
import { baseTools } from "../src/tools.ts";
import { createMockProvider } from "../src/provider/mock.ts";
import type { AgentEvent, AgentMessage } from "../src/types.ts";

function inTempDir(): { dir: string; restore: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "mini-agent-"));
  const old = process.cwd();
  process.chdir(dir);
  return { dir, restore: () => process.chdir(old) };
}

test("一轮工具调用：user / assistant / tool / assistant", async () => {
  const temp = inTempDir();
  try {
    writeFileSync(join(temp.dir, "README.md"), "hello mini agent\n", "utf8");
    const result = await runAgent({
      provider: createMockProvider(),
      tools: baseTools,
      messages: [{ role: "user", content: "读 README" }],
    });
    assert.equal(result.stopReason, "stop");
    assert.deepEqual(
      result.messages.map((m) => m.role),
      ["user", "assistant", "tool", "assistant"],
    );
    const tool = result.messages[2];
    assert.equal(tool.role === "tool" && tool.isError, false);
  } finally {
    temp.restore();
  }
});

test("maxTurns 用完就退出，stopReason 是 maxTurns", async () => {
  const result = await runAgent({
    provider: createMockProvider(),
    tools: baseTools,
    messages: [{ role: "user", content: "读 README" }],
    maxTurns: 1,
  });
  assert.equal(result.stopReason, "maxTurns");
  assert.equal(result.turns, 1);
  assert.equal(result.messages.length, 3);
});

test("工具抛错不炸循环，结果带 isError", async () => {
  const temp = inTempDir();
  try {
    const result = await runAgent({
      provider: createMockProvider(),
      tools: baseTools,
      messages: [{ role: "user", content: "读 不存在的文件" }],
    });
    const tool = result.messages[2];
    assert.equal(tool.role === "tool" && tool.isError, true);
    assert.equal(result.stopReason, "stop");
  } finally {
    temp.restore();
  }
});

test("工具没有描述，mock 就不选它", async () => {
  const tools = baseTools.map((tool) =>
    tool.name === "read" ? { ...tool, description: "" } : tool,
  );
  const result = await runAgent({
    provider: createMockProvider(),
    tools,
    messages: [{ role: "user", content: "读 README" }],
  });
  assert.equal(result.messages.length, 2);
  assert.equal(result.stopReason, "stop");
});

test("事件顺序固定：start → turn → text → end", async () => {
  const events: AgentEvent[] = [];
  const messages: AgentMessage[] = [{ role: "user", content: "你好" }];
  await runAgent({
    provider: createMockProvider(),
    tools: baseTools,
    messages,
    emit: (event) => events.push(event),
  });
  assert.deepEqual(
    events.map((event) => event.type),
    ["agent_start", "turn_start", "text_delta", "turn_end", "agent_end"],
  );
});
