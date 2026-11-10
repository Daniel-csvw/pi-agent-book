import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./loop.ts";
import { toLlm } from "./messages.ts";
import { compactIfNeeded } from "./compact.ts";
import { Session } from "./session.ts";
import { baseTools, writeTool } from "./tools.ts";
import { createMockProvider } from "./provider/mock.ts";
import { createFixtureProvider } from "./provider/fixture.ts";
import { createOpenAIProvider } from "./provider/openai.ts";
import type { AgentEvent, AgentMessage, Provider, StopReason } from "./types.ts";

const argv = process.argv.slice(2);
let providerName = "mock";
let sessionFile = "";
let prompt = "";
let maxTurns = 3;
let withWrite = false;
let print = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--mock") providerName = "mock";
  else if (arg === "--fixture") providerName = "fixture";
  else if (arg === "--openai") providerName = "openai";
  else if (arg === "--session") sessionFile = argv[++i] ?? "";
  else if (arg === "--max-turns") maxTurns = Number(argv[++i] ?? 3);
  else if (arg === "--tools") withWrite = true;
  else if (arg === "--print") print = true;
  else prompt = [prompt, arg].filter(Boolean).join(" ");
}

function pickProvider(): Provider {
  if (providerName === "openai") return createOpenAIProvider();
  if (providerName === "fixture") {
    return createFixtureProvider("fixtures/openai-basic.jsonl");
  }
  return createMockProvider();
}

const provider = pickProvider();
const tools = withWrite ? [...baseTools, writeTool] : baseTools;
const session = sessionFile ? Session.load(sessionFile) : null;
const history: AgentMessage[] = session ? [...session.messages] : [];

function remember(message: AgentMessage): void {
  history.push(message);
  session?.append(message);
}

function printEvent(event: AgentEvent): void {
  if (event.type === "text_delta") stdout.write(event.text);
  else if (event.type === "turn_start") stdout.write(`\n[turn ${event.turn}] `);
  else if (event.type === "tool_start") stdout.write(`\n-> ${event.name} `);
  else if (event.type === "tool_end") stdout.write(event.isError ? "[err]" : "[ok]");
  else if (event.type === "agent_end") stdout.write(`\n[${event.stopReason}]\n`);
}

function project(all: AgentMessage[]) {
  const compacted = compactIfNeeded(all, { threshold: 900, keep: 4 });
  if (compacted.compacted) {
    console.log(`\n[compact] ${compacted.dropped} 条 → 1 条摘要`);
  }
  return toLlm(compacted.messages);
}

async function handle(input: string): Promise<StopReason> {
  const user: AgentMessage = { role: "user", content: input };
  remember(user);
  const result = await runAgent({
    provider,
    tools,
    messages: history,
    maxTurns,
    project,
    emit: printEvent,
  });
  const fresh = result.messages.slice(history.length);
  for (const message of fresh) remember(message);
  return result.stopReason;
}

if (prompt) {
  const reason = await handle(prompt);
  if (print) console.log(JSON.stringify(history.slice(-4), null, 2));
  process.exitCode = reason === "error" ? 1 : 0;
} else {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log(`mini-agent · provider=${provider.name} · /exit 退出`);
  for (;;) {
    const line = (await rl.question("> ")).trim();
    if (!line) continue;
    if (line === "/exit") break;
    await handle(line);
  }
  rl.close();
}
