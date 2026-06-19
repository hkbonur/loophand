---
title: Early Returns Over Nested Conditionals
impact: MEDIUM
tags: typescript, react, control-flow, readability
---

When a function or component has guard conditions, return early. Don't pile branches into a dense ternary or nested `if`/`else` when an early return makes the null/loading/error path explicit.

Applies equally to plain functions, hooks, and React component bodies.

## Why It Matters

- The reader doesn't have to track which branch they're in
- Each guard reads as a precondition, not a side path
- Type narrowing is automatic — the rest of the function operates on the narrowed type

## ❌ Incorrect

```ts
function format(user: User | null, status: Status) {
  return user
    ? status === 'active'
      ? `${user.name} (active)`
      : status === 'pending'
      ? `${user.name} (pending)`
      : user.name
    : 'unknown'
}
```

```tsx
function Component() {
  const foo = React.useMemo(() => {
    if (deps.bar && deps.baz) return computeExpensive(deps.bar, deps.baz)
    return null
  }, [deps])
}
```

## ✅ Correct

```ts
function format(user: User | null, status: Status) {
  if (!user) return 'unknown'
  if (status === 'active') return `${user.name} (active)`
  if (status === 'pending') return `${user.name} (pending)`
  return user.name
}
```

```tsx
function Component() {
  const foo = React.useMemo(() => {
    if (!deps.bar || !deps.baz) return null
    return computeExpensive(deps.bar, deps.baz)
  }, [deps])
}
```

## Additional Notes

- Preserve the declared return type — don't change `T | null` to `T` just because every branch happens to return `T`
- Early returns + `switch` on discriminated unions is the cleanest combo for state-machine code
- One-line ternaries are fine; the issue is *nested* ones
- In components: handle `loading` / `error` / `empty` with early returns before the main render
