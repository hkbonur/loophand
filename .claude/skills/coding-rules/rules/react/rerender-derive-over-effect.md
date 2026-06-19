---
title: Derive in Render, Don't Sync via Effects
impact: MEDIUM
tags: rerender, derived-state, useEffect, dependencies
---

If a value can be computed from props/state, compute it during render. Don't store it in state and sync via `useEffect`. When you must use an effect, depend on the narrowest primitive possible — usually a derived boolean.

## Why It Matters

- An extra `useState` + sync effect costs two renders per change (the trigger, then the post-effect render)
- Effects depending on raw objects re-run on unrelated field changes
- A boolean derived in render only re-renders when the boolean flips, not on every input pixel

## ❌ Incorrect

```tsx
// (1) Storing derived state in useEffect
function Form(props: { firstName: string; lastName: string }) {
  const [fullName, setFullName] = React.useState('')
  React.useEffect(() => {
    setFullName(`${props.firstName} ${props.lastName}`)
  }, [props.firstName, props.lastName])
  return <p>{fullName}</p>
}

// (2) Subscribing to a continuous value
function Sidebar() {
  const width = useWindowWidth() // updates on every pixel
  const isMobile = width < 768
  return <nav className={isMobile ? 'mobile' : 'desktop'} />
}

// (3) Effect depending on a whole object
React.useEffect(() => {
  log(user.id)
}, [user]) // re-runs on any user field change
```

## ✅ Correct

```tsx
// (1) Compute during render
function Form(props: { firstName: string; lastName: string }) {
  const fullName = `${props.firstName} ${props.lastName}`
  return <p>{fullName}</p>
}

// (2) Subscribe to the boolean directly
function Sidebar() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  return <nav className={isMobile ? 'mobile' : 'desktop'} />
}

// (3) Depend on the primitive
React.useEffect(() => {
  log(user.id)
}, [user.id])
```

## Additional Notes

- Reset state on a prop change with a `key` instead of a sync effect
- For expensive derivations, wrap in `React.useMemo` (not state + effect)
- See [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
