import { readFileSync } from "node:fs";
import type { Provider, ProviderChunk } from "../types.ts";

/**
 * 把录好的一段回复重放成 chunk。
 * 文件格式：一行一个 chunk（JSON），空行和 # 开头的行忽略。
 */
export function createFixtureProvider(file: string): Provider {
  const chunks = loadChunks(file);
  if (chunks.at(-1)?.type !== "done") {
    throw new Error(`${file} 最后一行必须是 done`);
  }
  return {
    name: "fixture",
    async *stream() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

export function loadChunks(file: string): ProviderChunk[] {
  const raw = readFileSync(file, "utf8");
  const chunks: ProviderChunk[] = [];
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    let chunk: ProviderChunk;
    try {
      chunk = JSON.parse(line) as ProviderChunk;
    } catch {
      const head = line.slice(0, 40);
      throw new Error(`${file}:${i + 1} 不是 JSON：${head}`);
    }
    if (!["text", "toolCall", "done"].includes(chunk.type)) {
      throw new Error(`${file}:${i + 1} 未知 chunk 类型`);
    }
    chunks.push(chunk);
  }
  return chunks;
}
