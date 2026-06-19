---
title: Always Import React and Use Namespace
impact: CONSISTENCY
tags: react, hooks, namespace, best-practices
---

Always import React at the top of files and use the React namespace for hooks.

## Why It Matters

Using the React namespace consistently:

- Makes it immediately clear these are React hooks
- Prevents naming conflicts with custom hooks
- Improves code searchability
- Provides consistent patterns across the codebase

## ❌ Incorrect

```tsx
import { useState, useCallback, useMemo, useRef } from 'react'

function Component() {
  const [state, setState] = useState(false)
  const callback = useCallback(() => {}, [])
  const memoizedValue = useMemo(() => computeExpensive(), [deps])
  const ref = useRef<HTMLDivElement>(null)
}
```

## ✅ Correct

```tsx
import React from 'react'

function Component() {
  const [state, setState] = React.useState(false)
  const callback = React.useCallback(() => {}, [])
  const memoizedValue = React.useMemo(() => computeExpensive(), [deps])
  const ref = React.useRef<HTMLDivElement>(null)
}
```

## Additional Notes

This applies to all React hooks:

- `React.useState`
- `React.useEffect`
- `React.useCallback`
- `React.useMemo`
- `React.useRef`
- `React.useContext`
- `React.useReducer`
- `React.useLayoutEffect`
