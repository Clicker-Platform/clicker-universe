# Registration Flow — Design Spec

**Date:** 2026-05-08
**Status:** Approved, ready for implementation plan
**Owner:** @a@etalas.com

## Goal

Capture interest from prospects who want to sign up to Clicker, including which modules/bundles they need, custom requests, and an optional promo code. Submissions land in a dedicated Backyard screen where the superadmin reviews and manually activates the tenant. Promo usage commits only on successful activation.

Notifications (email) are explicitly out of scope for v1 — superadmin checks Backyard manually. Hook in once the Resend foundation lands.

## Non-Goals

- Self-serve tenant provisioning (everything still requires manual Backyard activation)
- Email notifications to superadmin (deferred until Resend ships)
- Editing bundles via UI (hardcoded in `lib/registration/bundles.ts`, edited via code)
- Auto-detecting duplicates (badge only, no merge logic)
- Public-facing tenant status / "where's my account?" lookup

---

## Architecture

### Surfaces

1. **Public registration page** — `clicker.id/register`, lives in `clicker-platform-v2` as an unauthenticated public route. Single canonical entry point.
2. **Auth-gateway link** — `auth.clicker.id` login form gains "Don't have an account? Register interest →" linking to `/register`.
3. **Marketing site CTA** — links to the same `/register` URL.
4. **Backyard screen** — new module at `backyard/registrations` (list + detail views) with activation flow.

### Data Model

**Collection:** `registrationRequests/{requestId}` (root-level Firestore, not under any site).

```ts
interface RegistrationRequest {
  id: string;

  // Contact
  name: string;
  email: string;
  phone: string;

  // Business
  businessName: string;
  businessType: 'fnb' | 'auto-detailing' | 'beauty-spa' | 'retail' | 'service' | 'other';
  city: string;
  expectedOutlets: number;

  // Intent
  bundle: string | null;          // bundle id picked, or null if individual
  modules: string[];              // resolved flat list of module ids
  customRequest: string;          // free-text, can be empty
  promoCode: string | null;
  promoCodeValidAtSubmit: boolean;

  // Lifecycle
  status: 'pending' | 'contacted' | 'activated' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // After activation
  activatedSiteId: string | null;
  activatedAt: Timestamp | null;
  rejectionReason: string | null;

  // Internal
  internalNotes: string;          // superadmin-only notes
  source: string | null;          // utm/referrer captured silently
}
```

**Security rules:**
- `create`: public (anonymous) — server-side validation enforces shape, required fields, and rate limits
- `read`, `update`, `delete`: superadmin only

**Validation on create (server-side):**
- Required: name, email (RFC format), phone (Indonesian format), businessName (≥2 chars), businessType, city
- `expectedOutlets`: integer ≥ 1
- Empty intent guard: `modules.length > 0 || customRequest.trim().length > 0`
- `promoCode`: if present, must pass existence check (delegated to promo module's existing validator)
- All other fields default to safe values; ignore unknown fields

### Bundles (Code-Defined)

**File:** `clicker-platform-v2/lib/registration/bundles.ts`

```ts
export interface Bundle {
  id: string;
  name: string;
  description: string;
  modules: string[];      // module ids from the module registry
}

export const BUNDLES: Bundle[] = [
  {
    id: 'restaurant-starter',
    name: 'Restaurant Starter',
    description: 'Self-order POS + stock management for cafés and restaurants.',
    modules: ['byod_pos', 'inventory'],
  },
  {
    id: 'auto-detailing',
    name: 'Auto Detailing Pro',
    description: 'Service records, warranty cards, and loyalty for detailing shops.',
    modules: ['service_records', 'membership', 'promo'],
  },
  {
    id: 'beauty-spa',
    name: 'Beauty / Spa',
    description: 'Bookings, member loyalty, and promos for beauty salons and spas.',
    modules: ['reservation', 'membership', 'promo'],
  },
];
```

Adding a bundle later = append an entry, redeploy. Modules in the "pick individually" list are derived live from the module registry (`lib/modules/*/definitions.ts`), so new modules show up automatically without bundle edits.

### Promo Validation

**Public endpoint:** `GET /api/public/validate-promo?code=XYZ`

Returns:
```ts
{ valid: boolean; name?: string; reason?: string }
```

- Read-only, no usage commit
- Calls into existing promo module's evaluator with a "validation-only" mode (does not increment usage, does not require a tenant context)
- Rate-limited by IP

### Activation Flow

When superadmin clicks **Activate** on a registration detail:

1. Backyard tenant forge opens with `?fromRegistration={requestId}` query param
2. Forge prefills fields:
   - Business name → tenant display name
   - Owner email → tenant owner email
   - Owner name → tenant owner profile
   - Slug → auto-suggested kebab-case of business name (editable, live uniqueness check)
   - Enabled modules → registration's `modules` array
   - Promo code → display-only ("Promo: XYZ — will apply on creation")
3. Superadmin reviews/edits and clicks **Create**
4. Tenant is created via existing forge logic
5. **Post-create hook:**
   - Update registration: `status='activated'`, `activatedSiteId`, `activatedAt`
   - If promo present and still valid: call `commitPromoUsage` against the new tenant
   - If promo commit fails: log error, show "Retry promo" affordance on registration detail (tenant is already live, recoverable)
6. If tenant creation itself fails, registration stays `pending` (no partial state)

---

## Components & File Layout

### `clicker-platform-v2/`

```
app/
  (public)/
    register/
      page.tsx                  # Public registration page (server component shell)
      RegisterForm.tsx          # Client form
      sections/
        ContactSection.tsx
        BusinessSection.tsx
        ModulesSection.tsx      # bundles + individual checklist
        CustomRequestSection.tsx
        PromoCodeSection.tsx
      submit-action.ts          # Server action: validate + write to Firestore
  api/
    public/
      validate-promo/
        route.ts                # Public promo existence check

lib/
  registration/
    bundles.ts                  # BUNDLES constant
    schema.ts                   # Zod schema for RegistrationRequest
    constants.ts                # Collection paths
    types.ts                    # TS types
    api.ts                      # Server-side helpers (createRequest, validatePromoForRegistration)
```

### `backyard/`

```
app/
  registrations/
    page.tsx                    # List view
    [id]/
      page.tsx                  # Detail view
      ActivateButton.tsx        # Opens forge with prefill
      RejectModal.tsx
      InternalNotes.tsx
  api/
    registrations/
      [id]/
        activate/route.ts       # Post-tenant-create hook (status update + promo commit)
        reject/route.ts
        notes/route.ts

components/
  registrations/
    StatusBadge.tsx
    ModulesList.tsx
    PromoCard.tsx               # Re-validates promo on mount
```

### Tenant Forge Integration

The existing tenant forge gains a `fromRegistration` query param. When present:
- Reads the registration via Cloud Function or direct admin SDK
- Prefills the forge form
- On successful tenant creation, invokes the activation hook above

---

## Data Flow

### Submission

```
User fills /register form
  ↓
Client validates (Zod) — required fields, format
  ↓
Client calls /api/public/validate-promo (if code present)
  ↓
Submit action invoked (server)
  ↓
Server re-validates (Zod), rate-limit check, promo re-check
  ↓
Firestore write to registrationRequests/{newId}
  ↓
Client navigates to thank-you state
```

### Activation

```
Superadmin opens Backyard /registrations
  ↓
List filtered by status (default: pending)
  ↓
Click row → detail view
  ↓
Promo re-validates live on detail open
  ↓
Click Activate → tenant forge opens with ?fromRegistration={id}
  ↓
Forge prefills, superadmin reviews, clicks Create
  ↓
Tenant created (existing forge logic)
  ↓
Post-create hook:
  ├─ Update registration: status=activated, activatedSiteId, activatedAt
  └─ commitPromoUsage(siteId, code) — best-effort
  ↓
Redirect superadmin to new tenant's admin or back to registrations list
```

---

## Edge Cases

1. **Duplicate submissions (same email):** Allowed. List view shows "⚠ N prior requests" badge if email matches existing pending/contacted rows. Manual review only — no auto-merge.
2. **Promo expires between submit and activation:** Detail view re-validates on open. If invalid, prefill strips the code; superadmin sees warning.
3. **Promo usage cap exhausted:** Same path as expired.
4. **Slug collision:** Forge handles via existing live uniqueness check; prefilled slug is just a suggestion.
5. **Activation partial failure (tenant created, promo commit failed):** Tenant stays live; registration shows "Retry promo" button on detail.
6. **Empty intent (no modules, no custom request):** Form-level guard blocks submit.
7. **Rate limiting:** Public submit + promo validate endpoints rate-limited by IP (5/hour for submit, 30/hour for validate). Implement via Firestore counter or in-memory map (LRU by IP) — pick simplest.
8. **Spam:** Empty intent guard + rate limiting cover most. Add reCAPTCHA later if needed.

---

## Testing

**Unit:**
- Bundle → modules resolution
- Zod schema (valid/invalid payloads)
- Slug suggestion logic
- Promo validation endpoint (valid, expired, exhausted, missing)

**Integration:**
- Form submit → Firestore write happy path
- Form submit with invalid promo → blocked
- Activation hook → registration update + promo commit
- Activation with expired promo → registration update only, no commit

**Manual (staging — clicker-universe-stagging):**
- Full flow: marketing CTA → form → submit → Backyard → activate → new tenant lives
- Edge: submit with no modules but custom request → succeeds
- Edge: submit with promo, wait for expiry, activate → warning shown
- Edge: rapid-fire submissions from one IP → rate limit kicks in

---

## Open Items (Resolved Inline)

- **Module display names** — pulled from each module's `definitions.ts` (`displayName`, `description` fields)
- **Bundle visual treatment** — card layout, finalized during build
- **Source tracking** — capture utm params and referrer silently into `source` field for future marketing analytics

---

## Out of Scope (for v1)

- Email notifications (deferred to post-Resend)
- Settings UI to edit bundles (code-only for now)
- Self-serve activation (always manual)
- reCAPTCHA / advanced bot defense (rate limit only)
- Webhook / Slack notifications
- Lead scoring or auto-prioritization
