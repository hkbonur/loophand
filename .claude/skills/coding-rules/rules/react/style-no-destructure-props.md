---
title: Never Destructure Props
impact: CONSISTENCY
tags: react, props, destructuring, best-practices
---

Always access props with dot notation (`props.value`) instead of destructuring.

## Why It Matters

- Makes it immediately clear when you're accessing a prop vs local variable
- Easier to track prop usage throughout the component
- Simplifies adding new props (no need to update destructuring)
- More explicit about data flow
- Easier to search for prop usage with `props.`

## ❌ Incorrect

```tsx
interface Props {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

function Button({ variant, disabled, children, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn('btn', { 'btn-primary': variant === 'primary' })}
    >
      {children}
    </button>
  )
}
```

```tsx
function UserCard({ user, onSave }: Props) {
  const handleSave = React.useCallback(() => {
    onSave(user)
  }, [user, onSave])

  return <div>{user.name}</div>
}
```

## ✅ Correct

```tsx
interface Props {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

function Button(props: Props) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn('btn', { 'btn-primary': props.variant === 'primary' })}
    >
      {props.children}
    </button>
  )
}
```

```tsx
function UserCard(props: Props) {
  const handleSave = React.useCallback(() => {
    props.onSave(props.user)
  }, [props.user, props.onSave])

  return <div>{props.user.name}</div>
}
```

## Additional Notes

- This applies to all components, including small ones
- Use `props.` consistently throughout the component
- When spreading props to a child element, use `{...props}` directly
