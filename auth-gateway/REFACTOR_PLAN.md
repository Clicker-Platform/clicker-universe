# Auth Gateway Refactor Plan

**Target:** Cleanup dev artifacts, fix security issues, compact logic
**Scope:** `dev/auth-gateway/` (4 source files, 454 lines total)

---

## P0 — Urgent Security & Cleanup (~30 min)

### 1. Remove config leak in firebase.ts
**File:** `lib/firebase.ts:21-26`
**Issue:** Logs `projectId` and `authDomain` to browser console on every page load.
**Action:** Delete the `if (typeof window !== 'undefined') { console.log(...) }` block.

### 2. Remove commented-out emulator block + unused imports
**File:** `lib/firebase.ts:34-49`
**Issue:** Dead commented code + 3 unused imports (`connectFunctionsEmulator`, `connectAuthEmulator`, `connectFirestoreEmulator`).
**Action:** Remove entire commented block. Change `import { getFunctions, connectFunctionsEmulator }` to `import { getFunctions }`. Remove the two standalone emulator imports entirely.

### 3. Remove debug console.logs in page.tsx
**File:** `app/page.tsx`
**Lines:**
- L31: `console.log('[Auth Gateway] performHandoff already in progress...')`
- L190: `console.log("User found, attempting auto-handoff...")`
**Action:** Delete both lines.

### 4. Fix @ts-ignore → proper typing
**File:** `app/page.tsx:71-77`
**Current:**
```tsx
// @ts-ignore
if (!result.data || !result.data.token) {
  throw new Error('No token received.');
}
// @ts-ignore
const handoffToken = result.data.token;
```
**Replace with:**
```tsx
const handoffData = result.data as { token?: string };
if (!handoffData?.token) {
  throw new Error('No token received.');
}
const handoffToken = handoffData.token;
```

### 5. Fix hardcoded '.clicker.id' domain
**File:** `app/page.tsx:172`
**Current:**
```tsx
document.cookie = '__session=; path=/; max-age=0; Domain=.clicker.id; SameSite=Lax; Secure';
```
**Replace with:**
```tsx
const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
document.cookie = `__session=; path=/; max-age=0; Domain=.${baseDomain}; SameSite=Lax; Secure`;
```

### 6. Remove thinking-out-loud comments
**File:** `app/page.tsx:206-220`
**Current:** 15 lines of internal thinking comments in `handleLogin`.
**Replace entire block with just:**
```tsx
await signInWithEmailAndPassword(auth, email, password);
setIsChecking(true);
await performHandoff();
```

### 7. Fix localStorage.clear() → targeted cleanup
**File:** `app/logout/page.tsx:30`
**Current:** `localStorage.clear()` — nukes ALL localStorage including other apps.
**Replace with:**
```tsx
localStorage.removeItem('__auth_session');
localStorage.removeItem('__tenant_cache');
```

### 8. Remove debug console.log in logout
**File:** `app/logout/page.tsx:18`
**Current:** `console.log('Logged out of Gateway');`
**Action:** Delete the line.

---

## P1 — Logic Refactor (~1 hour)

### 9. Extract `resolvePlatformUrl()` helper
**File:** `app/page.tsx:82-131` (50 lines of URL resolution)
**Action:** Extract to `lib/resolve-platform-url.ts`:
```tsx
export function resolvePlatformUrl(options: {
  redirectTo: string | null;
  currentUser: User | null;
}): Promise<string>
```
This contains the 5-path branching logic:
1. From `?redirect=` param origin
2. From `__tenant` cookie + `.web.app` path-based
3. From `__tenant` cookie + custom domain subdomain-based
4. From `localhost` fallback
5. From Firebase Auth claims `siteId`

### 10. Extract `clearSessionCookies()` helper
**Issue:** Cookie clearing duplicated in 3 places with inconsistent patterns.
**Action:** Create `lib/session.ts`:
```tsx
export function clearSessionCookies() {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
  if (isSecure && baseDomain) {
    document.cookie = `__session=; path=/; max-age=0; Domain=.${baseDomain}; SameSite=Lax; Secure`;
  }
}
```
**Replace in:** `page.tsx:47-50`, `page.tsx:171-172`, `logout/page.tsx:21-27`

### 11. Resolve double handoff trigger
**Issue:** Both `onAuthStateChanged` listener (L188) AND `handleLogin` (L220) call `performHandoff()`.
**Action:** Remove `performHandoff()` from `handleLogin`. After `signInWithEmailAndPassword`, just set `isChecking = true` — the `onAuthStateChanged` listener will fire and handle handoff. The `handoffInProgress` ref guard already prevents double execution, but having one trigger point is cleaner.

### 12. Consistent error messages language
**Issue:** Mix of Indonesian and English error messages.
**Action:** Standardize to Indonesian (matches the target user base):
- L150: `Auto-login failed: ...` → `Gagal login otomatis: ...`
- L223: `Invalid email or password.` → `Email atau password salah.`
- L225: `Too many failed attempts...` → `Terlalu banyak percobaan gagal...`

---

## P2 — Cleanup (~20 min)

### 13. Remove unused public assets
**Files:** `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`
**Action:** Delete all 5 files (Next.js boilerplate, not used anywhere).

### 14. Remove unused dependencies
**File:** `package.json`
**Remove:**
- `lucide-react` — zero imports across all auth-gateway files
- `clsx` + `tailwind-merge` — only in `lib/utils.ts` `cn()` which is never called
**Also remove:** `lib/utils.ts` (dead file)

### 15. Audit sonner usage
**File:** `package.json` + `app/layout.tsx`
**Issue:** `Toaster` imported in layout but no `toast()` calls in any auth-gateway file.
**Action:** Keep for now (might be used for future error toasts), but flag as candidate for removal.

---

## Expected Result After All Sprints

| File | Before | After |
|---|---|---|
| `lib/firebase.ts` | 51 lines (config leak, dead code) | ~25 lines (clean) |
| `app/page.tsx` | 310 lines (spaghetti handoff) | ~220 lines (extracted helpers) |
| `app/logout/page.tsx` | 53 lines (localStorage.clear bomb) | ~40 lines (targeted cleanup) |
| `lib/resolve-platform-url.ts` | N/A | ~40 lines (NEW) |
| `lib/session.ts` | N/A | ~15 lines (NEW) |
| `lib/utils.ts` | 6 lines (unused) | DELETED |

**Total: 420 → ~340 lines**, cleaner, no security leaks, no dev artifacts.
