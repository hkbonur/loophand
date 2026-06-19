---
name: coding-rules
description: Curated TypeScript and React rule atoms for this codebase. Each rule is a single self-contained file under rules/typescript/ or rules/react/, covering type modeling, performance, re-render hygiene, and code style. Consult while writing, reviewing, or refactoring code; consumed by the cleanup and forge skills.
---

# Coding Rules

Knowledge base of small, self-contained rule files for this React + TypeScript + Convex monorepo. Each rule describes _what good looks like_; process skills (`cleanup`, `forge`) describe _when to apply them_.

## When to Use

- Writing or reviewing new code — open the rule for the pattern at hand
- Driven by `@.claude/skills/cleanup/` during a post-change pass
- Driven by `@.claude/skills/forge/` during the per-component build loop
- Standalone lookup ("how do we model state machines here?")

Rules don't run on their own. Read the file directly when applying — don't paraphrase from this index.

## Rule File Shape

1. Frontmatter: `title`, `impact`, `tags`
2. One-paragraph statement
3. **Why It Matters** — bullet reasons
4. **❌ Incorrect** + **✅ Correct** — code examples
5. **Additional Notes** — edge cases, exceptions, related rules

## TypeScript

Type modeling, control flow, naming, dead code. Apply higher-impact rules first.

| Impact | Rule                                                                   | Topic                                                          |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| HIGH   | [ts-narrow-types](rules/typescript/ts-narrow-types.md)                 | Declared types match runtime states only                       |
| HIGH   | [ts-discriminated-unions](rules/typescript/ts-discriminated-unions.md) | Model state machines with tagged unions                        |
| HIGH   | [ts-no-any-no-assertions](rules/typescript/ts-no-any-no-assertions.md) | Avoid `any`, `as Foo`, and `!` outside boundaries              |
| HIGH   | [ts-no-silent-fallbacks](rules/typescript/ts-no-silent-fallbacks.md)   | Throw or return typed errors; never stub-on-failure            |
| HIGH   | [ts-one-source-of-truth](rules/typescript/ts-one-source-of-truth.md)   | Hoist shared constraints, statuses, magic numbers              |
| MEDIUM | [ts-derive-from-schemas](rules/typescript/ts-derive-from-schemas.md)   | `z.infer` / Convex `Doc` over hand-written interfaces          |
| MEDIUM | [ts-honest-names](rules/typescript/ts-honest-names.md)                 | `find*` vs `get*`, `try*` vs `parse*` — names match contract   |
| MEDIUM | [ts-early-returns](rules/typescript/ts-early-returns.md)               | Guard-clause style; applies to TS + React                      |
| MEDIUM | [ts-guard-function-over-bool-chain](rules/typescript/ts-guard-function-over-bool-chain.md) | Three+ guards joined with `&&` → named function with one early return per guard |
| MEDIUM | [ts-predicate-callback-early-returns](rules/typescript/ts-predicate-callback-early-returns.md) | Predicate callback (`match`/`filter`/`some`) with 2+ conditions → block body with early-return guards |
| MEDIUM | [ts-no-needless-wrappers](rules/typescript/ts-no-needless-wrappers.md) | Inline single-use pass-through helpers                         |
| MEDIUM | [ts-delete-dead-code](rules/typescript/ts-delete-dead-code.md)         | Remove unused exports, unreachable branches, legacy shims      |
| LOW    | [ts-prefer-cast-over-type-guard](rules/typescript/ts-prefer-cast-over-type-guard.md) | `(node as Element).type === 'x'` over `Element.isElement(node) && node.type === 'x'` |

## React

Priority ladder: async > re-render > advanced > style.

### Async (HIGH)

| Impact   | Rule                                                          | Topic                                              |
| -------- | ------------------------------------------------------------- | -------------------------------------------------- |
| CRITICAL | [async-parallel](rules/react/async-parallel.md)               | `Promise.all()` for independent operations         |
| HIGH     | [async-defer-await](rules/react/async-defer-await.md)         | Move `await` into branches that actually use it    |

### Re-render (MEDIUM)

| Impact | Rule                                                                                      | Topic                                                          |
| ------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| MEDIUM | [rerender-derive-over-effect](rules/react/rerender-derive-over-effect.md)                 | Derive in render; subscribe to booleans; narrow effect deps    |
| MEDIUM | [rerender-memo](rules/react/rerender-memo.md)                                             | When to memo, when not, and the default-value trap             |
| MEDIUM | [rerender-stable-prop-refs](rules/react/rerender-stable-prop-refs.md)                     | Hoist or memoize inline `{}`/`[]`/fn props                     |
| MEDIUM | [rerender-functional-setstate](rules/react/rerender-functional-setstate.md)               | `setX(curr => ...)` for stable callbacks                       |
| MEDIUM | [rerender-lazy-state-init](rules/react/rerender-lazy-state-init.md)                       | Function form of `useState` for expensive initial values       |
| MEDIUM | [rerender-move-effect-to-event](rules/react/rerender-move-effect-to-event.md)             | User-action side effects belong in handlers                    |
| MEDIUM | [rerender-use-ref-transient-values](rules/react/rerender-use-ref-transient-values.md)     | `useRef` for high-frequency non-render values                  |

### Advanced (LOW)

| Impact | Rule                                                                          | Topic                                              |
| ------ | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| LOW    | [advanced-event-handler-refs](rules/react/advanced-event-handler-refs.md)     | Stable subscriptions via handler refs              |

### Style (CONSISTENCY)

| Rule                                                                                  | Topic                                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [style-react-namespace](rules/react/style-react-namespace.md)                         | `import React from 'react'`; `React.useState` etc.          |
| [style-no-destructure-props](rules/react/style-no-destructure-props.md)               | `props.x`, never destructure                                |
| [style-props-interface](rules/react/style-props-interface.md)                         | Always name the props interface `Props`                     |
| [style-cn-utility](rules/react/style-cn-utility.md)                                   | `cn()` object syntax for Tailwind conditionals              |
| [style-naming-conventions](rules/react/style-naming-conventions.md)                   | Components / hooks / handlers / files — quick reference     |
| [style-component-organization](rules/react/style-component-organization.md)           | Internal order, import order, folder structure              |
| [style-component-decomposition](rules/react/style-component-decomposition.md)         | Named JSX child sub-components, not render-node props       |
| [style-list-keys](rules/react/style-list-keys.md)                                     | Stable unique keys; never index keys for reorderable lists  |

## Layout

```
rules/
├── typescript/    type modeling, control flow, naming, dead code
└── react/         async, re-render, advanced, style
```
