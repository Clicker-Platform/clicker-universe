# QA Audit Report: Business Manager Module

## Executive Summary
The Business Manager module is functional and uses modern React patterns (Optimistic UI, Server Components). However, it lacks robust input validation and has potential scalability limits due to unbounded queries. Security rules are configured for a single-tenant architecture.

## 1. Security Analysis
### Firestore Rules
*   **Status**: ⚠️ **Caution**
*   **Finding**: `rules_version = '2'; allow read: if true;` for `branches`.
    *   **Implication**: Anyone can read all branch data. This is acceptable for a public-facing business website (single-tenant), but if this system is meant to host multiple different businesses (multi-tenant), this is a data leak.
    *   **Recommendation**: Ensure this is strictly a single-tenant application. If multi-tenant, add `where('userId', '==', auth.uid)` constraints.

### Client-Side Security
*   **Status**: ✅ **Pass**
*   **Finding**: All writes use `addDoc`, `updateDoc`, `deleteDoc` directly.
    *   **Protection**: Protected by `allow write: if isAuthenticated()` in Security Rules. This prevents unauthorized modifications.

## 2. Data Integrity & Code Quality
### Optimistic Updates
*   **Status**: ✅ **Pass (with Note)**
*   **Finding**: The optimistic update logic relies on `router.refresh()` and a `useEffect` hook to resync state on error.
    *   **Observation**: While functionally correct, explicit error rollback (reverting state manually on catch) provides a faster correction than waiting for a server round-trip.

### Input Validation
*   **Status**: ❌ **Fail**
*   **Finding**: `BusinessSettingsClient.tsx` lacks input validation.
    *   **Phone Number**: Accepts text/invalid chars.
    *   **Map URL**: Accepts invalid strings (e.g., "not-a-url").
    *   **Address**: No length limits.
*   **Recommendation**: Implement Zod or Regex validation before submission.

## 3. Performance
### Server-Side Rendering
*   **Status**: ⚠️ **Warning**
*   **Finding**: `page.tsx` fetches all branches: `getDocs(query(branchesRef, orderBy('order', 'asc')))`.
    *   **Risk**: If a business has 500+ branches, this page load will degrade significantly. The data size is unbounded.
    *   **Recommendation**: Implement pagination or a hard limit (e.g., `limit(100)`).

## 4. User Experience
*   **Status**: ✅ **Pass**
*   **Finding**:
    *   Loading states are handled (`isSubmitting`).
    *   Optimistic updates provide instant feedback.
    *   Confirmation dialog prevents accidental data loss.

## Recommended Action Plan
1.  **High Priority**: Add input validation for Phone and URL fields.
2.  **Medium Priority**: Add `limit()` to the server-side query to prevent OOM/timeouts on large datasets.
3.  **Low Priority**: Implement explicit state rollback in `catch` blocks for smoother error handling.
