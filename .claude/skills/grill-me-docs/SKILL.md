---
name: grill-me-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time and if a question can be answered by exploring the codebase, explore the codebase instead. Do not ask obvious answers.

## Explain before asking

Before each question, make sure I actually understand what's being decided. Don't assume I know the jargon — I might not. For any concept that isn't trivially obvious, explain it FIRST, simply:

- **Lead with a concrete, runnable example**, not an abstract definition. Pick a tiny real scenario, simple to understand for anyone not familiar with the codebase.
- **Show the problem before the solution.** State what breaks if we do nothing
- **Use plain words and short code/data snippets** over prose. Name the jargon term once, in bold, right after I've already understood the thing it labels — so the term sticks to a concrete picture.
- **Keep it short** — a few sentences and a tiny example at most. If the concept is complex, break it down into multiple questions.

The goal: I should be able to picture exactly what each option does to a real form before I pick. A decision I don't understand isn't a decision I can own.

## Response conventions

- I respond `y`/`n`. `y` always means OK / do the recommended option.
- For multiple-choice, present options with numbers (1, 2, 3, ...). I reply with the number.
- Use the `AskUserQuestion` tool when available to ask the question. Otherwise ask in plain text.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>
