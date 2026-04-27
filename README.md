# Clicker Universe (Monorepo)

Multi-tenant SaaS platform. Each tenant gets a public biolink/website + admin dashboard with optional add-on modules.

---

## Repository Structure

This repo uses **git worktrees** — `main/` and `dev/` are separate working directories on their respective branches.

```
clicker-universe/
├── main/                       ← Production worktree (branch: main)
│   ├── clicker-platform-v2/   ← Main Next.js platform (port 3000)
│   ├── auth-gateway/          ← Login service / auth.clicker.id (port 3012)
│   ├── backyard/              ← Super-admin dashboard (port 3011)
│   ├── functions/             ← Firebase Cloud Functions
│   └── scripts/               ← Deployment & utility scripts
├── dev/                        ← Development worktree (branch: dev)
└── ARCHITECTURE.md             ← Single source of truth for architecture
```

---

## Quick Start

```bash
# Install all dependencies
make install

# Start services (separate terminals)
make dev           # platform     → localhost:3000
make dev-auth      # auth-gateway → localhost:3012
make dev-backyard  # backyard     → localhost:3011
```

Copy `.env.example` to `.env.local` in each sub-app and fill in credentials.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router, React 19 |
| Language | TypeScript |
| Backend | Firebase (Firestore, Auth, Storage, Functions) |
| Cache | Upstash Redis (REST) + in-process memory |
| Styling | Tailwind CSS v4 |
| Package Manager | pnpm |
| Testing | Vitest |

---

## Modules

| Module | Description |
|---|---|
| `byod_pos` | Self-Order POS — cashier, KDS, transactions, menu |
| `membership` | Loyalty program — members, tiers |
| `inventory` | Stock management |
| `stocklens` | AI-powered inventory scanner (Gemini Vision) |
| `reservation` | Booking & scheduling |
| `ai_sales` | Gemini AI chatbot for sales/lead capture |
| `service_records` | Vehicle service records, warranty, reminders |
| `sales_pipeline` | CRM Kanban board |

---

## Key Commands

```bash
make dev              # Start main platform
make build            # Production build
make test             # Run Vitest
make lint             # ESLint
make deploy-staging   # Deploy to staging
make worktree-list    # List active git worktrees
```

See `ARCHITECTURE.md` for the full architecture reference.
