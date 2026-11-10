/**
 * E03 的终点：同一份 loop.ts，换一个 provider 就换了一种「模型」。
 * 运行：cd examples/mini-agent && node src/demo-model.ts
 */
import { loadChunks, createFixtureProvider } from "./provider/fixture.ts";
import { runAgent } from "./loop.ts";
import { toLlm } from "./messages.ts";

const basic = "fixtures/openai-basic.jsonl";
const tool = "fixtures/openai-tool.jsonl";

function describe(file: string): void {
  console.log(`\n${file}`);
  for (const chunk of loadChunks(file)) {
    if (chunk.type === "text") {
      console.log(`  text     ${chunk.text}`);
    } else if (chunk.type === "toolCall") {
      const args = JSON.stringify(chunk.args);
      console.log(`  toolCall ${chunk.name} ${args}`);
    } else {
      console.log(`  done     ${chunk.stopReason}`);
    }
  }
}

describe(basic);
describe(tool);

/* 同一个循环，provider 换成回放：一行代码都不用改 */
const result = await runAgent({
  provider: createFixtureProvider(basic),
  tools: [],
  messages: [{ role: "user", content: "你好" }],
  maxTurns: 2,
  project: toLlm,
  emit: (event) => {
    if (event.type === "text_delta") process.stdout.write(event.text);
  },
});
console.log(`\nturns=${result.turns} stop=${result.stopReason}`);
