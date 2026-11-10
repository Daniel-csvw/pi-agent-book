import type { AgentMessage, Message, NoteMessage } from "./types.ts";

/**
 * 唯一出口：AgentMessage → Message。
 * 多出来的 note 在这里翻译成 user 消息；缺一条 case 就抛错，
 * 所以「忘了一个角色」会在开发时立刻暴露，而不是悄悄丢历史。
 */
export function toLlm(messages: AgentMessage[]): Message[] {
  const out: Message[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
      case "user":
      case "assistant":
      case "tool":
        out.push(message);
        break;
      case "note":
        out.push({ role: "user", content: renderNote(message) });
        break;
      default: {
        const unknown = message as { role?: string };
        throw new Error(`unhandled: ${String(unknown.role)}`);
      }
    }
  }
  return out;
}

function renderNote(note: NoteMessage): string {
  return `<note kind="${note.kind}">${note.text}</note>`;
}

