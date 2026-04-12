# Changelog — Clicker Universe

All notable changes to the Clicker Universe monorepo are documented here.  
For detailed per-app changelogs see [`clicker-platform-v2/CHANGELOG.md`](clicker-platform-v2/CHANGELOG.md).

---

## [Unreleased]

### Added
- `AGENTS.md` — Universal agent instructions for all AI tools
- `CLAUDE.md` — Claude Code project instructions
- `TECH-STACK.md` — Approved tech stack to prevent agent drift
- `ARCHITECTURE.md` — High-level monorepo architecture reference
- `CONVENTIONS.md` — Coding conventions and development guide
- `CONTRIBUTING.md` — Contributor guide
- `llms.txt` — LLM-friendly project description
- `.env.example` — Documents required environment variables
- `.editorconfig` — Editor consistency config
- `.gitattributes` — Line ending normalization and AI context control
- `.nvmrc` — Node 22 runtime pinning
- `Makefile` — Shorthand commands for dev, build, test, lint
- `vitest.config.ts` — Root-level test runner config
- `tsconfig.json` — Root TypeScript project references
- `eslint.config.mjs` — Root linter config
- `.prettierrc` — Formatter config
- `tests/` — Root test directory with fixtures
- `clicker-platform-v2/AGENTS.md` — Nested agent instructions for the main platform
- `.agents/` — Organized AI assets directory

---

## [2026-03-28] — Platform v2

See [`clicker-platform-v2/CHANGELOG.md`](clicker-platform-v2/CHANGELOG.md) for full details.

### Highlights
- DeviceView Context System for Canvas Studio device preview
- Warranty Card PDF generation via `@react-pdf/renderer`
- AI Sales Agent lazy loading with `ChatWidgetLoader`
- PageStudio Global Settings live refresh
- Server-side Reservation data hydration
