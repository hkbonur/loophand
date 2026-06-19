---
title: Always Name Props Interface "Props"
impact: CONSISTENCY
tags: react, props, interface, naming, best-practices
---

For single-component files, always name the props interface `Props`, never `ComponentNameProps`.

## Why It Matters

- Reduces verbosity and cognitive load
- Creates consistent patterns across all components
- Single component per file is the expected pattern
- Makes refactoring easier (rename component without renaming interface)

## ❌ Incorrect

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

function Button(props: ButtonProps) {
  // ...
}
```

```tsx
interface UserCardProps {
  user: User
  onSave: (user: User) => void
}

function UserCard(props: UserCardProps) {
  // ...
}
```

## ✅ Correct

```tsx
interface Props {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

function Button(props: Props) {
  // ...
}
```

```tsx
interface Props {
  user: User
  onSave: (user: User) => void
}

function UserCard(props: Props) {
  // ...
}
```

## Additional Notes

- This assumes one component per file (the recommended pattern)
- For files with multiple components, use descriptive names only when necessary
- Export components, not the Props interface (it's internal)
