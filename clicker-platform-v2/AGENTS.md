# AGENTS.md — clicker-platform-v2

Module-specific agent instructions for the **main Next.js platform**. Read the root [`AGENTS.md`](../AGENTS.md) first for monorepo-wide rules.

---

## Build & Test

```bash
pnpm install        # Install dependencies
pnpm dev            # Dev server on port 3000
pnpm build          # Production build
pnpm lint           # ESLint (eslint.config.mjs)
pnpm test           # Vitest (vitest.config.ts)
pnpm test:watch     # Vitest watch mode
```

## Project Structure

```
clicker-platform-v2/
├── app/
│   ├── admin/          ← Admin dashboard routes (Core features)
│   ├── api/            ← API routes (server-only, firebase-admin)
│   └── [tenant]/       ← Public tenant pages
├── components/         ← Shared UI components
├── hooks/              ← Custom React hooks
├── lib/
│   ├── core/           ← Universal features (all tenants)
│   ├── modules/        ← Opt-in module system
│   │   ├── definitions.ts   ← Module registry (edit when adding module)
│   │   └── components.tsx   ← Dynamic import map
│   ├── firebase.ts     ← Client SDK
│   ├── firebase-admin.ts ← Admin SDK (server only)
│   ├── site-context.tsx  ← useSite() — tenant resolution
│   └── user-context.tsx  ← useUser() — auth + RBAC
├── scripts/            ← DB seeding utilities
├── __tests__/          ← Vitest tests
├── Docs/               ← Deep architecture docs
├── tsconfig.json       ← TypeScript (strict mode)
├── eslint.config.mjs   ← ESLint config
└── vitest.config.ts    ← Vitest config
```

## Key Rules (enforced here)

1. **Server vs Client** — `firebase-admin` is used only in `app/api/` and server components. Client components import from `@/lib/firebase`.
2. **Module isolation** — `lib/modules/{name}/` cannot import from another module directory.
3. **DB paths** — Always use constants from `lib/modules/{name}/constants.ts`.
4. **RBAC** — All write handlers in client components must call `canEdit()` before executing.
5. **TypeScript** — `strict: true` is enabled. No `any` without justification.
6. **Tailwind** — Admin UI uses neutral style. No `border-[2px]`, no `shadow-sticker` in admin.

## Adding a New Module (3-Way Parity Rule)

Touch all 4 files — **all three definitions sources must stay in parity**:
```
lib/modules/definitions.ts             ← platform source of truth (paths + componentKeys)
../backyard/lib/modules/definitions.ts ← must match platform exactly + add displayName/description
scripts/seed-modules.ts                ← routes must match definitions.ts exactly
lib/modules/components.tsx             ← dynamic import for every componentKey
```

Also create:
```
lib/modules/{name}/
├── constants.ts   ← all Firestore paths
├── types.ts       ← TypeScript types
├── api.ts         ← client-side Firestore helpers
└── api-server.ts  ← server-side admin helpers (if needed)
```
