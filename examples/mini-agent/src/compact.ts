import type { AgentMessage, NoteMessage } from "./types.ts";

export interface CompactOptions {
  threshold?: number;
  keep?: number;
}

export interface CompactResult {
  messages: AgentMessage[];
  compacted: boolean;
  tokensBefore: number;
  dropped: number;
}

/** 粗估：JSON 字符数 / 4。不追求准，只追求「先有一道闸」。 */
export function estimateTokens(messages: AgentMessage[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

/**
 * 两道闸门：先看 token 估计，再看末尾保留几条。
 * 过闸就把早期消息压成一条 note，最近 keep 条原样留下。
 */
export function compactIfNeeded(
  messages: AgentMessage[],
  options: CompactOptions = {},
): CompactResult {
  const threshold = options.threshold ?? 8000;
  const keep = options.keep ?? 6;
  const tokensBefore = estimateTokens(messages);
  if (tokensBefore <= threshold || messages.length <= keep) {
    return { messages, compacted: false, tokensBefore, dropped: 0 };
  }
  const cut = messages.length - keep;
  const head = messages.slice(0, cut);
  const tail = messages.slice(cut);
  const note: NoteMessage = {
    role: "note",
    kind: "summary",
    display: true,
    timestamp: Date.now(),
    text: `<summary>${summarize(head)}</summary>`,
  };
  return {
    messages: [note, ...tail],
    compacted: true,
    tokensBefore,
    dropped: cut,
  };
}

function summarize(messages: AgentMessage[]): string {
  const users = messages.filter((m) => m.role === "user").length;
  const results = messages.filter((m) => m.role === "tool").length;
  return `早期 ${messages.length} 条（user ${users} / tool ${results}）`;
}
