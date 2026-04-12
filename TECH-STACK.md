# Tech Stack — Clicker Universe

> Prevents agents from introducing unwanted frameworks or libraries.

---

## Approved Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | **Next.js App Router** (v16+) | Do NOT use Pages Router patterns |
| UI Library | **React 19** | Server Components by default |
| Language | **TypeScript** (strict) | No plain JS in new files |
| Styling | **Tailwind CSS v4** | No CSS Modules, no styled-components |
| Database | **Firebase Firestore** (NoSQL) | Real-time listeners on client |
| Auth | **Firebase Authentication** | |
| Storage | **Firebase Storage** | |
| Server SDK | **firebase-admin** | Server components & API routes ONLY |
| Testing | **Vitest** + jsdom | No Jest |
| Package Manager | **pnpm** | Do NOT use npm or yarn |
| Drag & Drop | **@dnd-kit** | Do NOT add react-beautiful-dnd |
| Rich Text | **Tiptap v3** | Do NOT add Quill or Slate |
| PDF | **@react-pdf/renderer** | |
| AI / LLM | **@google/generative-ai** (Gemini) | Used in AI Sales Agent module |
| Deployment | **Firebase Hosting** + Cloud Functions | |
| CI/CD | **GitHub Actions** | See `.github/workflows/` |
| Edge / CDN | **Cloudflare Workers** | `scripts/cloudflare-worker.js` |

---

## Do NOT Introduce

- `redux`, `zustand`, `jotai` — use React Context
- `axios` — use native `fetch`
- `moment.js` — use native `Date` or `date-fns`
- `lodash` — use native JS
- `react-query` / `swr` — use Firestore real-time listeners
- `jest` — use Vitest
- `yarn` / `npm` — use pnpm
- `styled-components` / `emotion` — use Tailwind
- Any new CSS framework or UI kit — discuss first

---

## Node Version

Node **22** (pinned via `.nvmrc` and `engines` field in `package.json`).

---

## Environment Variables

Defined in `.env.example`. All client-side vars must be prefixed with `NEXT_PUBLIC_`. Server-only vars (Firebase Admin) must NOT have this prefix.
