---
title: Prefer Local Cast Over Type Guard for Discriminant Checks
impact: LOW
tags: typescript, control-flow, readability
---

When narrowing a value by its `.type` (or another discriminant) inside a code path that already establishes the value's shape, prefer a single local cast — `(node as Element).type === 'paragraph'` — over chaining a type-guard predicate before the field access. The guard adds reading overhead without catching real bugs in this codebase, where Slate / schema types are wide and the discriminant is always present.

This rule is a sibling of `ts-no-any-no-assertions`. That rule prohibits assertions used to *change* a value's runtime contract. This rule allows them when the cast simply re-states a shape that the surrounding code has already guaranteed.

## Why It Matters

- A two-step `Element.isElement(n) && n.type === 'paragraph'` reads as "is this even an element? then check type" — but in practice the caller already knows it's an element. The first half is dead code.
- Adding more guards to that chain (`&& Editor.string(...) === ''`) pushes you toward `ts-guard-function-over-bool-chain`. A single cast keeps the expression at one guard, which the rule allows inline.
- Casts at the use-site are easy to grep; predicate calls hide the discriminant behind a helper.

## ❌ Incorrect

```ts
if (Element.isElement(node) && node.type === 'paragraph' && Editor.string(editor, path) === '') {
  // ...
}
```

```ts
const isEmptyParagraph =
  Element.isElement(blockBefore) && blockBefore.type === 'paragraph' && Editor.string(editor, path) === ''
```

## ✅ Correct

```ts
if ((node as Element).type === 'paragraph' && Editor.string(editor, path) === '') {
  // ...
}
```

```ts
// Even better — wrap in a named helper (ts-guard-function-over-bool-chain)
function isEmptyParagraphAt(editor: Editor, path: Path): boolean {
  if (!Editor.hasPath(editor, path)) return false
  const node = Node.get(editor, path) as Element
  if (node.type !== 'paragraph') return false
  return Editor.string(editor, path) === ''
}
```

## When It Applies

- Slate `Element` / `Node` discriminant checks where the surrounding code already operates on `editor.children`
- Schema-derived types where the consumer knows the shape (e.g. zod-inferred narrow types reaching wide-typed call sites)
- Discriminated-union members where the parent narrow has already happened upstream

## When It Doesn't

- The value comes from an external boundary (network, user input, untyped third-party API) — keep the runtime guard
- The discriminant might legitimately be missing (e.g. partial mock objects in tests)
- The cast would suppress a *real* bug a future refactor could introduce — favour `as unknown as T` and a comment, or model the type more precisely (`ts-narrow-types`)

## Related

- [`ts-no-any-no-assertions`](./ts-no-any-no-assertions.md) — assertions that change the runtime contract are still forbidden
- [`ts-guard-function-over-bool-chain`](./ts-guard-function-over-bool-chain.md) — three or more guards combined: extract to a named function
- [`ts-narrow-types`](./ts-narrow-types.md) — long term, narrow the shared type so the cast becomes unnecessary
