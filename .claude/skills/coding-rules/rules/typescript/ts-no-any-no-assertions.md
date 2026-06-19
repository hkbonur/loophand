---
title: No `any`, No Casual Assertions
impact: HIGH
tags: typescript, types, safety
---

Avoid `any`, `as Foo`, and `!` non-null assertions except at clearly-marked system boundaries (parsing, third-party untyped APIs). Inside the project, model the value correctly instead.

## Why It Matters

- `any` disables type-checking transitively — one `any` poisons every downstream signature
- Assertions hide invariants from the compiler instead of expressing them
- Future readers can't tell whether an assertion is load-bearing or a leftover

## ❌ Incorrect

```ts
function processForm(data: any) {
  return data.fields.map((f: any) => f.value as string)
}

const user = users.find(u => u.id === id)!
console.log(user.name)
```

## ✅ Correct

```ts
function processForm(data: FormSubmission) {
  return data.fields.map(f => f.value)
}

const user = users.find(u => u.id === id)
if (!user) throw new Error(`user ${id} not found`)
console.log(user.name)
```

## Additional Notes

- Boundary parsing (e.g. `JSON.parse` results, `fetch().json()`) is the right place for `unknown` + a schema validator
- `as const` and `as never` are not the same as `as Foo` — those narrow, they don't claim
- If you must assert, comment WHY in one line: invariant, recently-checked, or reason the compiler can't see it
