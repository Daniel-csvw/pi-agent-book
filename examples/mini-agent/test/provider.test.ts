import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createFixtureProvider, loadChunks } from "../src/provider/fixture.ts";
import { createMockProvider } from "../src/provider/mock.ts";
import type { ProviderChunk } from "../src/types.ts";

const basic = fileURLToPath(new URL("../fixtures/openai-basic.jsonl", import.meta.url));
const tool = fileURLToPath(new URL("../fixtures/openai-tool.jsonl", import.meta.url));

test("fixture 把 SSE 翻译成 text + done", () => {
  const chunks = loadChunks(basic);
  assert.deepEqual(chunks.map((chunk) => chunk.type), ["text", "text", "done"]);
  const done = chunks.at(-1);
  assert.equal(done && done.type === "done" && done.stopReason, "stop");
});

test("tool_calls 分片拼成完整参数", () => {
  const chunks = loadChunks(tool);
  const call = chunks.find((chunk) => chunk.type === "toolCall");
  assert.equal(call && call.type === "toolCall" && call.args.path, "README.md");
  const done = chunks.at(-1);
  assert.equal(done && done.type === "done" && done.stopReason, "toolUse");
});

test("同一份消息，mock 与 fixture 都是 done 收尾", async () => {
  const messages = [{ role: "user" as const, content: "你好" }];
  const providers = [createMockProvider(), createFixtureProvider(basic)];
  for (const provider of providers) {
    const seen: ProviderChunk[] = [];
    for await (const chunk of provider.stream(messages, [])) seen.push(chunk);
    assert.equal(seen.at(-1)?.type, "done");
  }
});
