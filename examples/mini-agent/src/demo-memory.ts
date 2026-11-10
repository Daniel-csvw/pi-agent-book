/**
 * E02 的终点：五种消息 → 四种消息，中间只有一道闸。
 * 运行：cd examples/mini-agent && node src/demo-memory.ts
 */
import { toLlm } from "./messages.ts";
import { runAgent } from "./loop.ts";
import { createMockProvider } from "./provider/mock.ts";
import type { AgentMessage, Message, NoteMessage } from "./types.ts";

/** 一段真会话：读文件、拿到结果、回话。四种老消息齐了。 */
const history: AgentMessage[] = [
  { role: "user", content: "读一下 README.md" },
  {
    role: "assistant",
    content: [
      { type: "text", text: "先看看文件。" },
      {
        type: "toolCall",
        id: "call_1",
        name: "read",
        args: { path: "README.md" },
      },
    ],
    stopReason: "toolUse",
  },
  {
    role: "tool",
    toolCallId: "call_1",
    toolName: "read",
    content: "# mini-agent",
  },
  {
    role: "assistant",
    content: [{ type: "text", text: "（mock）读完了。" }],
    stopReason: "stop",
  },
];

/** 系统自己记的一条：要进上下文，但不是用户说的话。 */
const note: NoteMessage = {
  role: "note",
  kind: "summary",
  text: "前 4 条已压缩：用户在问 README。",
  display: false,
  timestamp: 0,
};

function preview(message: Message): string {
  if (typeof message.content === "string") {
    return message.content.slice(0, 16);
  }
  const text = message.content.find((b) => b.type === "text");
  return text ? text.text.slice(0, 16) : "(toolCall)";
}

function lastUser(messages: AgentMessage[]): string {
  const llm = toLlm(messages);
  const user = [...llm].reverse().find((m) => m.role === "user");
  return user ? preview(user) : "(none)";
}

const projected = toLlm([...history, note]);
console.log(`历史 ${history.length + 1} 条 → 模型 ${projected.length} 条`);
for (const message of projected) {
  console.log(`  ${message.role.padEnd(9)} ${preview(message)}`);
}

/* note 变成 user 之后，位置决定它是不是「用户刚说的话」 */
const head = lastUser([note, ...history]);
const tail = lastUser([...history, note]);
console.log(`摘要放开头 → 最后一句 user: ${head}`);
console.log(`摘要放末尾 → 最后一句 user: ${tail}`);

/* 漏了一个角色时，闸门当场炸，不悄悄丢历史 */
try {
  toLlm([{ role: "unknown" } as unknown as AgentMessage]);
} catch (error) {
  console.log(`ERR: ${(error as Error).message}`);
}

/* 闸门接进循环：loop 的 project 参数就是这一处 */
const result = await runAgent({
  provider: createMockProvider(),
  tools: [],
  messages: [note, ...history],
  maxTurns: 2,
  project: toLlm,
  emit: (event) => {
    if (event.type === "text_delta") process.stdout.write(event.text);
  },
});
console.log(`\nturns=${result.turns} stop=${result.stopReason}`);
