import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createFixtureProvider, loadChunks } from "../src/provider/fixture.ts";
import { createMockProvider } from "../src/provider/mock.ts";
import type { ProviderChunk } from "../src/types.ts";

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));
const basic = here("../fixtures/openai-basic.jsonl");
const tool = here("../fixtures/openai-tool.jsonl");

test("fixture 重放 text + done", () => {
  const chunks = loadChunks(basic);
  const types = chunks.map((chunk) => chunk.type);
  assert.deepEqual(types, ["text", "text", "done"]);
  const done = chunks.at(-1);
  assert.equal(done && done.type === "done" && done.stopReason, "stop");
});

test("toolCall 带着参数和 toolUse 结尾", () => {
  const chunks = loadChunks(tool);
  const call = chunks.find((chunk) => chunk.type === "toolCall");
  const path = call && call.type === "toolCall" && call.args.path;
  assert.equal(path, "README.md");
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
