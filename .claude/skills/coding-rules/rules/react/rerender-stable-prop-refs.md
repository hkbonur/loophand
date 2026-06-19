---
title: Stable Prop References at Call Sites
impact: MEDIUM
tags: rerender, memo, references, optimization
---

Inline object/array/function literals create a new reference every parent render. Passed to a memoized child, they defeat `React.memo` silently — the child re-renders even though the data is identical.

## Why It Matters

- `React.memo` does shallow equality on props; `{}` and `[]` and `() => {}` never equal themselves across renders
- One unstable prop on a heavy child can erase a whole optimization budget
- The bug is invisible: nothing crashes, the app just feels slow

## ❌ Incorrect

```tsx
function Parent(props: { items: Item[] }) {
  return (
    <ExpensiveList
      items={props.items}
      filters={{ active: true }}            // new object each render
      onSelect={(id) => console.log(id)}    // new function each render
      sortKeys={['name', 'date']}           // new array each render
    />
  )
}
```

## ✅ Correct

```tsx
const DEFAULT_FILTERS = { active: true }
const SORT_KEYS = ['name', 'date'] as const

function Parent(props: { items: Item[] }) {
  const handleSelect = React.useCallback((id: string) => {
    console.log(id)
  }, [])

  return (
    <ExpensiveList
      items={props.items}
      filters={DEFAULT_FILTERS}
      onSelect={handleSelect}
      sortKeys={SORT_KEYS}
    />
  )
}
```

## Additional Notes

- Hoist truly static values to module scope — no hook overhead
- For values derived from props, use `React.useMemo` / `React.useCallback`
- Only matters when the child is wrapped in `React.memo` or uses the value as an effect dependency
- See `rerender-memo` for the matching default-value trap inside the component
