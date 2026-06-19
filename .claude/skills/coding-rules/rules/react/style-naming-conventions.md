---
title: Naming Conventions
impact: CONSISTENCY
tags: react, naming, conventions
---

Consistent names for components, hooks, handlers, props, and files.

## Quick Reference

| Type                | Convention             | Example                       |
| ------------------- | ---------------------- | ----------------------------- |
| Components          | PascalCase             | `UserProfileCard`             |
| Hooks               | camelCase, `use*`      | `useUserData`                 |
| Internal handlers   | `handle*` prefix       | `handleClick`                 |
| Callback props      | `on*` prefix           | `onClick`, `onSave`           |
| Boolean state/props | `is/has/should*`       | `isLoading`, `hasError`       |
| Files & folders     | kebab-case             | `user-profile-card.tsx`       |
| Constants           | SCREAMING_SNAKE_CASE   | `MAX_RETRY_COUNT` (see `ts-one-source-of-truth`) |

## Handlers vs Callback Props

```tsx
interface Props {
  onClick?: () => void  // 'on' prefix — caller-facing
}

function Button(props: Props) {
  const handleClick = () => {  // 'handle' prefix — internal
    props.onClick?.()
  }
  return <button onClick={handleClick} />
}
```

## Boolean Names

```tsx
// ✅
const [isLoading, setIsLoading] = React.useState(false)
const [hasError, setHasError] = React.useState(false)
<Modal isOpen={isOpen} />

// ❌ — bare nouns/adjectives without is/has/should
const [loading, setLoading] = React.useState(false)
<Modal open={open} />
```

## Filenames

Files and folders are kebab-case, even when they export PascalCase components. The exported identifier stays PascalCase or camelCase as appropriate.

```
✅
src/components/features/form-editor/form-editor-toolbar.tsx   // exports FormEditorToolbar
src/components/features/form-editor/use-form-editor.ts        // exports useFormEditor

❌
src/components/features/form-editor/FormEditorToolbar.tsx
```

Multi-letter acronyms stay one kebab token: `useOAuthPopup` → `use-oauth-popup.ts` (not `use-o-auth-popup.ts`).

**Excluded from kebab-case:**
- `src/routes/**` — TanStack Router derives URLs from filenames (`_layout.tsx`, `__root.tsx`, `$workspaceId.tsx`)
- Generated files: `*.gen.ts`
- Barrel files: `index.ts` / `index.tsx`
