# Contributing — Clicker Universe

## Getting Started

1. Clone the repository and check out the `main` branch.
2. Navigate to the app you want to work on:
   ```bash
   cd clicker-platform-v2
   pnpm install
   pnpm dev
   ```
3. Copy the environment file and fill in your values:
   ```bash
   cp ../.env.example .env.local
   ```

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `dev`  | Integration branch — merge features here first |
| `feat/*` | Feature branches |
| `fix/*` | Bug fix branches |

Always branch from `dev` and open PRs targeting `dev`.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add reservation waitlist support
fix: correct siteId resolution on subdomain
chore: update pnpm dependencies
docs: add module registration guide
refactor: extract Firestore helpers to lib/core/db.ts
test: add middleware tenant resolution tests
```

## Before Submitting a PR

- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm test` passes
- [ ] No `.env` files or secret keys committed
- [ ] New modules registered in all 4 required files (see `AGENTS.md`)
- [ ] RBAC guard added to all write operations in client components

## Architecture Rules

Read `AGENTS.md` before making changes. Key rules:
- Modules cannot import from each other.
- `firebase-admin` is server-only.
- All tenant data uses `siteId` from `useSite()` — never hardcode.
- Admin UI follows the neutral productivity-dashboard style (no brutalist styles).

## Project Structure

See `ARCHITECTURE.md` for a full breakdown.

## Questions?

Open a GitHub Discussion or check the docs in `clicker-platform-v2/Docs/`.
