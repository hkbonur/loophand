---
title: Memo Correctly (When To, When Not, And The Default-Value Trap)
impact: MEDIUM
tags: rerender, memo, useMemo, optimization
---

`React.memo` and `useMemo` only pay off when the work they skip is real and inputs are stable. Three patterns to internalize:

1. **Extract** expensive subtrees so siblings can early-return before the work runs.
2. **Don't memo** trivial primitive expressions — the comparison costs more than the recompute.
3. **Hoist non-primitive defaults** to module scope, otherwise `??` creates a fresh value each render and breaks `memo` equality.

> If the project uses [React Compiler](https://react.dev/learn/react-compiler), most manual memo can go. These rules still apply for correctness (default-value trap) and for non-compiled code paths.

## ❌ Incorrect

```tsx
// (1) Expensive work blocks an early return
function Profile(props: { user: User; isLoading: boolean }) {
  const avatar = React.useMemo(() => {
    return <Avatar id={computeAvatarId(props.user)} />
  }, [props.user])
  if (props.isLoading) return <Skeleton />  // already paid for avatar
  return <div>{avatar}</div>
}

// (2) Memo wrapping a trivial primitive
const isLoading = React.useMemo(
  () => props.user.isLoading || props.notifications.isLoading,
  [props.user.isLoading, props.notifications.isLoading]
)

// (3) Default value created inside the component breaks memo
const UserAvatar = React.memo(function UserAvatar(props: { onClick?: () => void }) {
  const handleClick = props.onClick ?? (() => {})  // new ref every render
})
```

## ✅ Correct

```tsx
// (1) Extract so the early return runs first
const UserAvatar = React.memo(function UserAvatar(props: { user: User }) {
  const id = React.useMemo(() => computeAvatarId(props.user), [props.user])
  return <Avatar id={id} />
})
function Profile(props: { user: User; isLoading: boolean }) {
  if (props.isLoading) return <Skeleton />
  return <div><UserAvatar user={props.user} /></div>
}

// (2) Inline — the boolean OR is cheaper than the memo machinery
const isLoading = props.user.isLoading || props.notifications.isLoading

// (3) Hoist the default
const NOOP = () => {}
const UserAvatar = React.memo(function UserAvatar(props: { onClick?: () => void }) {
  const handleClick = props.onClick ?? NOOP
})
```

## Additional Notes

- "Expensive" means measured. Don't memo on guesswork
- Same trap as (3) applies to call sites: `<Foo items={[]} />` creates a new array each render — see `rerender-stable-prop-refs`
- `useMemo` returning a primitive is almost never worth it; returning a referenced object that other hooks depend on is
