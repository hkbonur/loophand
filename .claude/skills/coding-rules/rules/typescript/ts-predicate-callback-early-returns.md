---
title: Early Returns in Predicate Callbacks
impact: MEDIUM
tags: typescript, control-flow, readability, predicates
---

When a predicate **callback** (a `match` / `filter` / `find` / `some` / `every` / route-matcher arrow that returns a boolean) combines two or more conditions, give it a block body with one early-return guard per condition instead of a single `&&`/`||` chain.

This refines [`ts-guard-function-over-bool-chain`](./ts-guard-function-over-bool-chain.md): that rule leaves inline two-guard chains (`if (a && b)`) alone, but a predicate callback is the place to expand even a two-condition chain — the callback already *is* the named boundary, so each condition reads as its own line without any extraction.

## Why It Matters

- Each condition is an independent precondition the reader can stop at — no left-to-right `&&` parsing
- A failing condition returns `false` explicitly, so mixed polarity (`a !== 'x' && b`) stays uniform
- Adding/removing a condition is a one-line diff, not a re-balance of operator precedence
- Matches the project habit of guard-clause control flow over compressed boolean expressions

## ❌ Incorrect

```ts
fetchMock.route({
  match: (url, method) => method === 'POST' && url.includes(NOTION_PAGES_URL),
  respond: () => respondNotionCreated(),
})
```

```ts
const dangling = refs.filter((r) => r.fieldId != null && !liveIds.has(r.fieldId))
```

## ✅ Correct

```ts
fetchMock.route({
  match: (url, method) => {
    if (method !== 'POST') return false
    return url.includes(NOTION_PAGES_URL)
  },
  respond: () => respondNotionCreated(),
})
```

```ts
const dangling = refs.filter((r) => {
  if (r.fieldId == null) return false
  return !liveIds.has(r.fieldId)
})
```

## When It Applies

- A predicate callback body that is a `&&`/`||` chain of two or more conditions
- Any condition whose meaning isn't obvious from the symbol alone (`method !== 'POST'`, `status !== 'LoadingFirstPage'`)

## When It Doesn't

- A single-condition callback: `(x) => x.active` — leave it inline
- Pure-data predicates with uniform polarity that read like math: `(x) => x > 0 && x < 100`
- A redundant `&&` null-guard on a value already non-nullable by type — drop the guard entirely, don't expand it (see [`ts-prefer-cast-over-type-guard`](./ts-prefer-cast-over-type-guard.md))

## Related

- [`ts-guard-function-over-bool-chain`](./ts-guard-function-over-bool-chain.md) — extract a NAMED function when a derived boolean (not a callback) chains 3+ guards
- [`ts-early-returns`](./ts-early-returns.md) — same shape, applied to nested ternaries / if-else trees
