import type { McpPrompt } from "../types";

// Surfaced on prompts/get so a connecting agent understands the loop contract.
export const identityPrompt: McpPrompt = {
  name: "identity",
  description: "What loophand is and how the human-in-the-loop task cycle works",
  content: `
# loophand

loophand is a human-in-the-loop kanban. You create review tasks for a human; they
resolve them; you read the result and continue.

## The loop
1. \`create_task\` — open a task. It appears live on the human's board as a card.
2. \`await_task\` — block (bounded long-poll) until the human resolves it. On a
   slow human turn it returns \`{ status: "pending", resume, poll_after_ms }\` —
   re-call it with the same task_id to keep waiting.
3. When resolved, the result returns and the card flips to "Agent working".
   Read it (or \`get_task\`) and continue your work.

## Outcomes
\`approved\`, \`changes_requested\` (rework and resume — not a dead end),
\`cancelled\`, \`expired\`.
`.trim(),
};
