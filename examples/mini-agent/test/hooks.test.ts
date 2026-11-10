import { test } from "node:test";
import assert from "node:assert/strict";
import { withHooks } from "../src/hooks.ts";
import { echoTool } from "../src/tools.ts";

test("block 之后工具根本不执行，错误文本回到模型", async () => {
  let ran = 0;
  const tool = {
    ...echoTool,
    execute() {
      ran += 1;
      return "不该出现";
    },
  };
  const hooked = withHooks([tool], {
    before: () => ({ block: "拒绝" }),
  })[0];
  assert.ok(hooked);
  await assert.rejects(() => hooked.execute({ text: "x" }), /拒绝/);
  assert.equal(ran, 0);
});

test("before 改参数、after 改返回值，各一层", async () => {
  const hooked = withHooks([echoTool], {
    before: () => ({ args: { text: "改写" } }),
    after: (_call, text) => `${text}!`,
  })[0];
  assert.ok(hooked);
  assert.equal(await hooked.execute({ text: "原始" }), "echo: 改写!");
});
