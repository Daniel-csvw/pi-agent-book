import type { AgentMessage } from "./src/types.ts";

const m = { role: "note" } as AgentMessage;
const x: never = m;
console.log("ran", typeof x);
