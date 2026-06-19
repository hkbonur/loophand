---
title: Guard Function Over Boolean Chain
impact: MEDIUM
tags: typescript, react, control-flow, readability
---

When a derived boolean is the AND of three or more guard conditions, extract a small named function that returns the boolean via early returns — one guard per line. Don't pile guards into a single `&&` chain that the reader has to parse left-to-right and mentally invert.

This rule complements `ts-early-returns` (which targets nested ternaries / if-else trees). Here the input is an inline `&&`/`||` chain that compresses several distinct guards into one expression.

## Why It Matters

- Each guard reads as an independent precondition — the reader can stop at the first one that matters
- Guards get names by association with the boolean returned, not by being decoded from `!isFoo` mid-expression
- Adding or removing a guard is a one-line diff, not a re-balancing of `&&`/`||` precedence
- Mixed-polarity chains (`a && !b && c && d !== 'x'`) become uniform — every branch returns `false` (or `true`) explicitly

## ❌ Incorrect

```ts
const showEmptyLanding =
  childFolders.length === 0 &&
  forms.length === 0 &&
  !hasActiveFilters &&
  formsStatus !== 'LoadingFirstPage'
```

```ts
const canPublish =
  !isPublishing && !hasErrors && form.isDirty && permissions.canEdit && quota.remaining > 0
```

## ✅ Correct

```ts
function shouldShowEmptyLanding() {
  if (formsStatus === 'LoadingFirstPage') return false
  if (hasActiveFilters) return false
  if (childFolders.length > 0) return false
  if (forms.length > 0) return false
  return true
}
```

```ts
function canPublish() {
  if (isPublishing) return false
  if (hasErrors) return false
  if (!form.isDirty) return false
  if (!permissions.canEdit) return false
  if (quota.remaining <= 0) return false
  return true
}
```

## When It Applies

- Three or more guards combined with `&&` (or `||` for "should skip" predicates — same rule, inverted)
- Mixed-polarity guards in the same chain (`a && !b && c !== 'x'`)
- Any guard whose meaning isn't obvious from the symbol alone (e.g. `formsStatus !== 'LoadingFirstPage'` reads better as a named line)

## When It Doesn't

- Two-guard chains: `if (a && b) return x` is fine
- Pure-data predicates with uniform polarity that read like math: `x > 0 && x < 100`
- Single-call helpers already named: `isReady() && isAuthorized()` — already self-documenting
- Tight loops where the function-call overhead matters (rare in app code)

## Naming

- Prefer `shouldX()` / `canX()` / `isX()` — verb prefix signals "predicate"
- The function name replaces the comment you would otherwise write above the chain
- Inline at the call site: `{shouldShowEmptyLanding() ? <Landing /> : <List />}` — no intermediate `const`

## Related

- [`ts-early-returns`](./ts-early-returns.md) — same shape, applied to nested ternaries / if-else trees
- [`ts-honest-names`](./ts-honest-names.md) — the function name must match what it actually returns
