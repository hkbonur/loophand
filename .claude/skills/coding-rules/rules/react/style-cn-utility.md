---
title: Use cn() Utility for Tailwind CSS Conditionals
impact: MEDIUM
impactDescription: simplifies className logic and prevents class conflicts
tags: react, tailwind, classnames, utility, best-practices
---

Use object syntax for conditional classes. The `cn()` utility merges Tailwind classes intelligently and handles conflicts.

## ❌ Incorrect

```tsx
className={cn('base', props.active && 'active', props.error ? 'error' : '')}
className={`base ${props.active ? 'active' : ''}`}
```

## ✅ Correct

```tsx
className={cn(
  'base-classes',
  {
    'conditional-class': props.condition,
    'another-conditional': props.isActive,
  },
  props.className
)}
```

## Example

```tsx
className={cn(
  'inline-flex items-center justify-center rounded-md font-medium',
  'disabled:pointer-events-none disabled:opacity-50',
  {
    'bg-primary text-primary-foreground': props.variant === 'default',
    'bg-destructive text-destructive-foreground': props.variant === 'destructive',
  },
  {
    'h-9 px-3 text-sm': props.size === 'sm',
    'h-10 px-4 py-2': props.size === 'default',
  },
  props.className
)}
```

**Order:** base classes → conditional objects → `props.className`
