import { toLlm } from "./src/messages.ts";
import type { AgentMessage, NoteMessage } from "./src/types.ts";

const base = (display: boolean): AgentMessage[] => [
  { role: "user", content: "hi" },
  {
    role: "note",
    kind: "summary",
    text: "so far",
    display,
    timestamp: 0,
  } satisfies NoteMessage,
];

const a = JSON.stringify(toLlm(base(false)));
const b = JSON.stringify(toLlm(base(true)));
console.log("display=false:", a);
console.log("display=true :", b);
console.log("same:", a === b);
