# Conventions — Clicker Platform

Coding conventions and development setup guide for agents and contributors.

---

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| React Server Component | `PascalCase.tsx` | `ProductList.tsx` |
| React Client Component | `PascalCase.tsx` with `'use client'` at top | `ProductForm.tsx` |
| Client component (explicit) | `*Client.tsx` | `OrdersClient.tsx` |
| API route | `route.ts` | `app/api/orders/route.ts` |
| Hook | `use*.ts` | `useOrders.ts` |
| Context | `*-context.tsx` | `site-context.tsx` |
| Constants | `constants.ts` | `lib/modules/pos/constants.ts` |
| Types | `types.ts` | `lib/modules/pos/types.ts` |
| Server API helpers | `api-server.ts` / `api-admin.ts` | |
| Client API helpers | `api.ts` | |

---

## Import Order

```typescript
// 1. React & Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party
import { doc, getDoc } from 'firebase/firestore';

// 3. Internal — lib
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';

// 4. Internal — components
import { Button } from '@/components/ui/Button';

// 5. Types
import type { Order } from './types';
```

---

## Component Patterns

### Server Component (default)
```tsx
// No 'use client' directive
import { adminDb } from '@/lib/firebase-admin';

export default async function Page() {
  const data = await adminDb.collection('...').get();
  return <div>...</div>;
}
```

### Client Component
```tsx
'use client';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';

export default function MyComponent() {
  const { siteId } = useSite();
  const { canEdit } = useUser();
  // ...
}
```

---

## Admin UI Patterns

```tsx
// Card / Container
<div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">

// Input
<input className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none" />

// Primary button
<button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark/90 shadow-sm transition-all">

// Status badge
<div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
  isActive ? 'bg-green-50 border-green-200 text-green-700'
           : 'bg-gray-100 border-gray-200 text-gray-400'
}`}>
```

**Never** use `border-[2px]`, `border-[3px]`, `shadow-sticker`, `border-brand-dark` on admin containers, or `hover:-translate-y-1` on admin cards.

---

## Database Conventions

- Paths are defined in `constants.ts` per module — never hardcode strings inline.
- All tenant data under `sites/{siteId}/`.
- Module data under `sites/{siteId}/modules/{module_name}/`.
- Use server-side reads (firebase-admin) for sensitive data; client-side listeners for real-time UI.

---

## TypeScript

- Strict mode is enabled — no `any` without justification.
- Define types in `types.ts` inside the relevant module or component folder.
- Use `type` for object shapes, `interface` only when extending is needed.

---

## Git Conventions

- Commit messages follow **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Branch naming: `feat/description`, `fix/description`
- Do not commit `.env` files, service account JSON keys, or `*.bak` files.

---

## Testing

- Test runner: **Vitest** with jsdom environment.
- Test files go in `__tests__/` or co-located as `*.test.ts`.
- Run: `pnpm test` from `clicker-platform-v2/`.
- Coverage config in `vitest.config.ts`.
