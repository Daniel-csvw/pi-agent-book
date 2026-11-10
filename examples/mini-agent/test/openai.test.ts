import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createOpenAIProvider } from "../src/provider/openai.ts";
import type { ProviderChunk } from "../src/types.ts";

test("openai 解析 SSE：一个事件被劈成两半也能拼回来", async () => {
  const lines = [
    'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    "data: [DONE]\n\n",
  ];
  const server = createServer(async (_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    /* 故意把第一个事件从中间切开，分两次 write；
       中间等 20ms，否则两个 write 会被合成一个网络块，测不到切割 */
    res.write(lines[0].slice(0, 20));
    await new Promise((resolve) => setTimeout(resolve, 20));
    res.write(lines[0].slice(20));
    for (const line of lines.slice(1)) res.write(line);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  const provider = createOpenAIProvider({
    baseUrl: `http://127.0.0.1:${port}`,
    apiKey: "test",
    model: "test",
  });
  const chunks: ProviderChunk[] = [];
  const messages = [{ role: "user" as const, content: "hi" }];
  try {
    for await (const chunk of provider.stream(messages, [])) {
      chunks.push(chunk);
    }
  } finally {
    /* 即使断言前就抛错，也要关服务器：否则测试会卡在不退出的状态 */
    server.close();
  }

  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ["text", "text", "done"],
  );
});
