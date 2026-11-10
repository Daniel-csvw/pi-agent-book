import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Session } from "../src/session.ts";
import { compactIfNeeded, estimateTokens } from "../src/compact.ts";
import type { AgentMessage } from "../src/types.ts";

test("追加两条，重启后原样读回", () => {
  const file = join(mkdtempSync(join(tmpdir(), "mini-session-")), "s.jsonl");
  const session = new Session(file);
  session.append({ role: "user", content: "第一句" });
  session.append({ role: "assistant", content: [], stopReason: "stop" });

  const again = Session.load(file);
  assert.equal(again.messages.length, 2);
  assert.deepEqual(again.messages, session.messages);
});

test("坏行报错带行号", () => {
  const file = join(mkdtempSync(join(tmpdir(), "mini-session-")), "bad.jsonl");
  appendFileSync(file, '{"role":"user","content":"ok"}\nnot-json\n', "utf8");
  assert.throws(() => Session.load(file), /:2 不是合法 JSON/);
});

test("超过阈值才压缩，末尾 keep 条不动", () => {
  const long = "字".repeat(200);
  const messages: AgentMessage[] = [];
  for (let i = 0; i < 10; i += 1) {
    messages.push({ role: "user", content: `${i}:${long}` });
  }
  const before = estimateTokens(messages);
  const result = compactIfNeeded(messages, { threshold: 100, keep: 3 });
  assert.equal(result.compacted, true);
  assert.equal(result.messages.length, 4);
  assert.equal(result.messages[0].role, "note");
  assert.ok(result.tokensBefore >= before);

  const small = compactIfNeeded(messages.slice(0, 2), { threshold: 100, keep: 3 });
  assert.equal(small.compacted, false);
});
