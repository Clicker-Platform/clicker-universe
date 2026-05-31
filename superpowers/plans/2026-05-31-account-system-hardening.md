# Account System — Audit & Hardening Plan

**Date:** 2026-05-31
**Scope:** The whole platform account tier (`/[tenant]/account/*`, `/api/account/*`) plus the digital_goods buyer surfaces that depend on it (`/api/digital-goods/*`, library + file access).
**Status:** Audit complete. Remediation not yet started.

---

## 0. Why this exists

Heavy per-feature planning still produced a system that *felt* broken: an empty library list, a download link that opened without login, and a worry that "the Firebase Admin SDK is exposed." This document replaces ad-hoc fixes with one audit + a prioritized remediation, organized around a **single invariant** instead of a list of patches.

**The root cause of the mess was never a security bug.** It was that identity is read through **two different SDKs depending on the surface** (client Firebase Auth SDK vs. server `__account_session`), and the client path **fails silently** (returns empty, not an error). Per-feature plans each shipped working in isolation; nobody owned the cross-cutting rule. That is what this plan fixes.

---

## 1. The invariant (the organizing principle)

> **Every buyer content read and every entitlement decision flows through the server session (`getAccountSession()` → `__account_session`), as the single enforcement door. The client Firebase Auth SDK is used only to *establish* the session, never to *gate content*.**

Adopt this and findings #1 and #2 below collapse into one consistent pattern. Everything else in the audit already conforms.

---

## 2. Audit results — verified facts (2026-05-31)

### 2.1 Claims that turned out FALSE (no action needed)

| Claim | Verdict | Evidence |
|---|---|---|
| "Firebase Admin SDK terexpose / shipped to client" | **FALSE** | No `'use client'` file imports `firebase-admin`/`adminDb`/`adminAuth`/`adminStorage`. Credential is `process.env.GCP_SERVICE_ACCOUNT_KEY` (NOT `NEXT_PUBLIC_*`), so Next never inlines it into the browser bundle. Admin SDK runs only in `runtime='nodejs'` route handlers. See `lib/firebase-admin.ts:22`. |
| "Product files are publicly downloadable / skip auth" | **FALSE (overstated)** | `storage.rules:18-21` sets `allow read: if false` on `sites/{siteId}/modules/digital_goods/products/files/**`. The only read path is a **signed URL**, minted only after `getAccountSession()` + library-ownership check (`server-api.ts:137-176`). |
| "`/api/account/admin/list` is unauthenticated" | **FALSE** | It requires a Bearer ID token, verifies it, and confirms the requester is the site **owner or a member** before returning. See `app/api/account/admin/list/route.ts:26-58`. (It correctly does NOT use the *buyer* session — it's a tenant/admin endpoint.) |

**Note on the signed URL you can open without login:** that is the *inherent* property of a GCS signed URL — once minted it is a time-limited bearer token (15 min, `SIGNED_URL_TTL_SECONDS`). The `GoogleAccessId=firebase-adminsdk-...@...iam.gserviceaccount.com` visible in the URL is the signer **identity/email**, not a credential; you cannot derive the private key from it.

### 2.2 Enforcement map — every relevant route

**Account tier (`/api/account/*`)**
- `auth/[action]` — no buyer session **by design** (this is how you log in) ✅
- `session`, `logout`, `preferences`, `surfaces` — enforce `__account_session` ✅
- `admin/list` — owner/member-gated via Bearer ID token ✅ (tenant endpoint, not buyer)

**Digital goods (`/api/digital-goods/*`)**
- `checkout`, `files/[fileId]`, `lookup-library` — enforce `getAccountSession()` ✅
- `orders/confirm`, `orders/cancel` — use `requireAuthedMember` (the **tenant/admin** session) ✅ correct — these are tenant actions, not buyer actions

**Verdict:** enforcement is *mostly* consistent and correct. The system is solid, not a rescue.

---

## 3. Genuine findings (the actual work)

### Finding #1 — Signed URL is re-shareable for its TTL window  🟡 Medium
- **What:** `issueSignedUrlForFile` (`lib/modules/digital_goods/server-api.ts:171`) returns a GCS signed URL with a 15-min TTL. `LibraryEntryClient.tsx` then `window.open`s it (so it also lands in browser history / address bar).
- **Real risk:** a legitimate buyer can copy and re-share *their own* valid link for up to 15 minutes. Not an open door; a leak *window*. For a paid-PDF product this is a (bounded) piracy vector.
- **Not in scope to over-engineer:** this is the standard S3/GCS pattern. The decision is only *how tight* to make it.

### Finding #2 — Library **list** reads client-SDK while everything else uses the server session  🟡 Medium
- **What:** the list path is `providers.ts` `fetchLibrary` → `surface.ts` `getLibraryForAccount` → `library.ts` `getLibraryForBuyer`, a **client-SDK** compound query (`where buyerId == user.uid` + `orderBy purchasedAt desc`). Detail/download/checkout/lookup all use the server session.
- **Real risk:** not a security hole (rules still enforce it), but it **fails silently** — the empty-library scare on 2026-05-31 was this query returning `[]` while the composite index (`firestore.indexes.json:19-25`) was still building on staging. A client query that returns empty-instead-of-error is brittle and confusing to debug.
- **This is the finding that caused the "mess" feeling.**

### Finding #4 — `lib/firebase-admin.ts` has no `server-only` guardrail  🟢 Low (optional)
- **What:** nothing structurally prevents a future dev from importing the admin module into a client component. Today nobody does (verified).
- **Caveat (from memory `project_no_server_only_import_in_tested_files`):** the `server-only` package isn't installed and breaks vitest resolution; adding it to a module imported by tested code has tradeoffs. Treat as optional hardening, possibly via lint rule instead of the package.

*(Finding #3 — admin/list auth — was investigated and cleared; see §2.1.)*

---

## 4. Remediation — prioritized

### P0 / P1 — Unify buyer content access on ONE server door  *(addresses #1 and #2 together)*

Single coherent change, not two patches:

1. **Add `GET /api/digital-goods/library`** (admin SDK + `getAccountSession()`), returning the caller's library entries. Mirror the existing `lookup-library` route pattern exactly.
2. **Repoint the list reads** in `app/[tenant]/account/page.tsx` and `app/[tenant]/account/library/page.tsx` to call that route via `providers.ts` `fetchLibrary`, instead of the client-SDK `getLibraryForBuyer`. Result: no more silent-empty client query; #2 resolved.
3. **Close the signed-URL window** for downloads — choose ONE (open decision, see §5):
   - **(a) Proxy/stream:** `files/[fileId]` route fetches the object server-side (session + ownership already checked per request) and streams bytes back with `Content-Disposition: attachment`. The GCS URL never reaches the client. Fully closes #1; costs server egress.
   - **(b) Tighten:** keep signed URL but drop TTL to ~60–120s and add `response-content-disposition=attachment`. Mitigation only; still shareable in the short window.
4. **Decide the fate of client-SDK `library.ts`:** after step 2, `getLibraryForBuyer` / `getLibraryEntry` may be dead or only used by the detail page. Detail page (`library/[entryId]/page.tsx`) currently reads by-ID via client SDK + JS entitlement filter — consider moving it to the server route too for full invariant compliance, or document why by-ID client read is acceptable.

### P2 — Optional hardening
5. Add a guardrail against importing `firebase-admin` from client code — lint rule preferred over the `server-only` package (vitest tradeoff). (#4)

### P3 — Doc hygiene (separate, cheap)
6. The `/digital_goods` skill file (`.claude/commands/digital_goods/`) still documents the **retired buyer system** (`modules/digital_goods/buyers/{uid}`, `__session`, `/store/login`). Update §1–§4 to reflect the account tier + gated checkout. (Tracked in memory: `project_auth_cookie_collision`, `project_member_tier_dashboard`.)

---

## 5. Open decisions (need user input before coding)

1. **Download protection (Finding #1):** proxy/stream (a, fully closes hole, costs egress) vs. tighten signed URL (b, mitigation only). *Recommendation: (a).*
2. **Detail page (step 4):** move by-ID read to server route for full invariant compliance, or leave on client SDK and document the exception?

---

## 5a. IMPLEMENTED (2026-05-31) — all verified working in dev

**P0/P1 — unified buyer access on the server door (Option A chosen):**
- New `GET /api/digital-goods/library` (admin SDK + `getAccountSession`) → `listLibraryForAccountAdmin` (surface-admin.ts). All three list readers (account home, library page, registered `LibrarySurface`) now go through `providers.ts fetchLibrary` → this route. Deleted dead client `surface.ts`.
- **Download now streams** (`getFileForBuyer` in server-api.ts; `files/[fileId]` route returns bytes with `Content-Disposition: attachment`). No GCS signed URL reaches the client → nothing to re-share. **User confirmed: no direct download, no shareable link.**
- Tests: get-file-for-buyer.test.ts (entitlement/IDOR/not-found/success) + listLibraryForAccountAdmin tests. Added `server-only` vitest alias (`test/stubs/server-only.ts`). 46 digital_goods+account tests pass.

**Post-login sidebar bug (found during testing, fixed, verified):**
- Symptom: after magic-link login, sidebar surfaces empty until manual hard refresh; `/api/account/surfaces` returned the item correctly.
- Cause: `VerifyClient` `router.replace` (soft nav) served `/account` from pre-login router cache.
- Fix: `window.location.assign(dest)` (full nav) on first authenticated load; removed unused `useRouter`.

**Still on client SDK (accepted exception):** detail-page `getLibraryEntry`, store `hasLibraryEntryForProduct` — single-doc reads, rules-enforced.

**NOT committed yet** — awaiting user decision.

## 5b. Deferred to Plan 3 (theme: hardening / anti-piracy / feature extension)

Raised 2026-05-31, intentionally NOT built now:

1. **Buyer keeps their copy after product delete.** Today `deleteProduct` (api.ts) hard-deletes ONLY the product doc; it leaves the `library/{id}` doc and the Storage file. Result: the library *list* still shows the item (renders from `productSnapshot`), but the entry page AND download both BREAK — `entryId/page.tsx` treats missing product as not-found, and `getFileForBuyer` throws `forbidden` when `productSnap.exists` is false (server-api.ts). The file is orphaned, not deleted. **Desired:** once purchased, buyer keeps working access. Fix options: (a) soft-delete/archive products instead of hard-delete; (b) **make library entries self-contained** — store file path(s)+metadata on the library entry at purchase, verify download against the entry not the live product (robust "you own your copy"; schema change). Prefer (b).

2. **Unique / watermarked download filename.** Today filename is fixed (`matched.name`). Tiers: (1) per-download random suffix — cosmetic, trivially renamed, near-useless for anti-piracy; (2) per-buyer deterministic name — mild support/debug value; (3) **in-PDF watermark** (buyer email/order stamped into content via pdf-lib) — the only one that survives renaming and actually deters leaks. Pairs naturally with the new streaming download (bytes already in hand server-side). Recommendation: skip 1/2 as security; do 3 if the goal is leak-tracing.

3. **Online PDF reader** (in-browser viewer, no download) — feature extension.

## Plan 4 (separate theme): LMS / course player inside Library Entry

See memory [[project_flow_blocks_vs_lms]] — configurable course player inside a Library Entry. Orthogonal to the storefront/library layer; its own phase.

## 6. What this plan deliberately does NOT do
- No rewrite of the auth/session system — it is sound.
- No change to tenant-side order confirm/cancel — correctly gated by `requireAuthedMember`.
- No change to magic-link login flow.
- No new "buyer identity" concept — the account tier is the identity; this plan only enforces it consistently.

---

## 7. Verification checklist (run before claiming any item done)
- [ ] Library list renders for a buyer with ≥1 paid entry (new server route), AND returns `[]` cleanly for a buyer with none.
- [ ] Composite index `library: buyerId ASC, purchasedAt DESC` confirmed **deployed** on `clicker-universe-stagging` (not just present in JSON).
- [ ] Download works for the owning buyer; a copied link from another browser/session **fails** (proxy) or **expires fast** (tighten), per chosen option.
- [ ] A second buyer cannot read the first buyer's library entry or file (entitlement holds on the server door).
- [ ] No `'use client'` file imports `firebase-admin` (re-grep after changes).
- [ ] `pnpm test` + `pnpm build` green.
