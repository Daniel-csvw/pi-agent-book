import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentMessage } from "./types.ts";

/**
 * 追加写、逐行读。一行一条消息，坏行直接报行号。
 * 没有数据库、没有迁移：这类文件的全部协议就是“别改格式”。
 */
export class Session {
  file: string;
  messages: AgentMessage[] = [];

  constructor(file: string) {
    this.file = file;
  }

  static load(file: string): Session {
    const session = new Session(file);
    if (!existsSync(file)) return session;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      try {
        session.messages.push(JSON.parse(line) as AgentMessage);
      } catch {
        throw new Error(`${file}:${index + 1} 不是合法 JSON`);
      }
    });
    return session;
  }

  append(message: AgentMessage): void {
    mkdirSync(dirname(this.file), { recursive: true });
    appendFileSync(this.file, JSON.stringify(message) + "\n", "utf8");
    this.messages.push(message);
  }
}
