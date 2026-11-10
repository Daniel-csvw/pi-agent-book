/**
 * E05 的终点：一道阈值，一条摘要，四个数字。
 * 运行：cd examples/mini-agent && node src/demo-compact.ts
 */
import { compactIfNeeded, estimateTokens } from "./compact.ts";
import { toLlm } from "./messages.ts";
import type { AgentMessage } from "./types.ts";

const long = "很长的内容".repeat(12);
const history: AgentMessage[] = Array.from({ length: 10 }, (_, i) => ({
  role: "user",
  content: `第 ${i + 1} 条：${long}`,
}));

const before = estimateTokens(history);
const result = compactIfNeeded(history, { threshold: 60, keep: 3 });

console.log(`tokens ${before} → ${estimateTokens(result.messages)}`);
console.log(`compacted ${result.compacted} dropped ${result.dropped}`);
console.log(`len ${result.messages.length} first ${result.messages[0]?.role}`);
if (result.messages[0]?.role === "note") {
  console.log(`note: ${result.messages[0].text}`);
}

/* 摘要进上下文的样子：一条 note，投影成一条 user，放在最前面 */
const llm = toLlm(result.messages);
console.log(`投影后 ${llm.length} 条`);
for (const message of llm) {
  const text = typeof message.content === "string" ? message.content : "";
  console.log(`  ${message.role.padEnd(9)} ${text.slice(0, 24)}`);
}
