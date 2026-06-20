# Product

## Register

product

## Users

People who delegate work to AI agents and want to stay in control of it. Developers and operators running one or more agents that need a human decision before they continue: approve this change, review this screenshot, sign off on this document, answer this question.

Their context: the human is not babysitting the agent. They glance at the board between other work, often on a phone, and want to answer the agent's request in seconds, then get back to what they were doing. The agent is blocked and waiting; latency on the human side is the bottleneck the product exists to shrink.

The job to be done: turn an agent's "I need a human" moment into a fast, unambiguous decision, and hand the result straight back to the agent so the loop keeps moving.

## Product Purpose

loophand is a human-in-the-loop kanban. An agent calls `create_task` over MCP and a card appears live on the human's board. The agent blocks on `await_task`; the human resolves the card (approve, request changes, cancel); the agent reads the result and continues. Review surfaces handle richer asks: annotate a screenshot, mark up a document, resolve several items at once.

Why it exists: agentic work stalls every time it needs human judgment, and the handoff is usually a mess of pasted links, Slack pings, and lost context. loophand makes that handoff a first-class object, a task with state, so neither side has to guess where things stand.

Success looks like: the human clears a request in seconds without hunting for context, the agent unblocks the instant they do, and a person can run several agents at once without the board ever feeling like a second job.

## Brand Personality

Quiet precision. Three words: calm, confident, legible. The Linear / Raycast lane, a tool that recedes so the work in front of you is the only thing that feels present. Voice is plain-spoken and exact: column and action labels read like a person talking ("Waiting on you", "Agent working"), never product jargon or hype. No exclamation marks, no cleverness for its own sake. The interface should feel like it respects the user's attention and trusts them to read.

## Anti-references

- **Generic SaaS slop.** No gradient hero-metric cards, identical icon-card grids, purple gradients, or the AI-template look. If it reads as "made by a landing-page generator", it is wrong.
- **Heavy enterprise.** No Jira / ServiceNow density, cluttered toolbars, nested panels, or visual noise. The board carries little chrome.
- **Crypto / neon.** No neon-on-black, glow effects, or hype aesthetic.
- **Cutesy / toy-like.** No over-rounding into a toy, emoji-as-UI, or mascot-driven unseriousness. Friendly is fine; unserious is not.

## Design Principles

1. **The loop is the product.** The agent to human to agent handoff is the core object. Every screen makes it obvious whose turn it is and what the next move is. Status is never something the user has to infer.

2. **Quiet by default, loud where it counts.** The board recedes into the background; the single task the user is acting on is the only thing that earns visual weight. Resist decorating the frame.

3. **Glanceable, then deep.** State is readable in a peripheral glance, often on a phone, between other work. Full review detail is one tap away, never forced up front.

4. **Trust through clarity.** Each state (waiting on you, resolved, agent working, done) is unambiguous and named in plain language. Requesting changes is a normal step in the loop, not a dead end or a failure.

5. **Respect the human's time.** The product exists because the agent is blocked and the human is busy. Every interaction is measured in seconds-to-decision. Cut anything that does not move a task toward resolved.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: contrast, full keyboard operability, visible focus rings (the token system already defines a `--ring`).
- Honor `prefers-reduced-motion`: the 180ms state transitions and any future motion must degrade gracefully.
- Maintain light and dark parity. Dark mode is a first-class theme in the token system, not an afterthought; nothing should only work in one mode.
- Status must never be carried by color alone (the four-column flow and outcome states need a label or shape, not just a hue) so it holds for color-blind users and in a fast glance.
