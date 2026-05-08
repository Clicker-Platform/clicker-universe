# Registration Flow — Brainstorming Session Notes

**Date:** 2026-05-08
**Outcome:** Spec + implementation plan written, not yet implemented.

## Artifacts

- **Spec:** [dev/superpowers/specs/2026-05-08-registration-flow-design.md](../specs/2026-05-08-registration-flow-design.md)
- **Plan:** [dev/superpowers/plans/2026-05-08-registration-flow-plan.md](../plans/2026-05-08-registration-flow-plan.md) — 15 tasks

## Goal (one-liner)

Public registration page at `clicker.id/register` to capture interest from prospects (contact, business info, modules/bundles, custom request, promo code). Submissions land in a new Backyard screen for manual activation via the existing tenant forge. Promo usage commits only on successful activation.

## Key Decisions

| Topic | Decision |
|-------|----------|
| Entry points | Marketing site CTA + auth-gateway link, all → single page `clicker.id/register` (no subdomain) |
| Form richness | Rich — contact, business type/city/outlets, modules, custom request, promo code |
| Promo code visibility | Always visible (not hidden behind toggle) |
| Module selection UX | Hybrid — 3 bundle cards on top + "pick individually" expandable checklist |
| Bundles for v1 | Restaurant Starter (POS+Inventory), Auto Detailing Pro (Service Records+Membership+Promo), Beauty/Spa (Reservation+Membership+Promo) |
| Bundle storage | Hardcoded in `lib/registration/bundles.ts` (not settings UI) — easy to edit via code |
| Module list source | Live-derived from existing module registry — new modules auto-appear |
| Promo validation timing | Hybrid — existence check on submit (immediate feedback), usage commits on activation |
| Storage | Dedicated root-level Firestore collection `registrationRequests` (not Forms/Inbox reuse) |
| Notifications | Out of scope for v1 — Backyard screen only. Email hooks in once Resend foundation ships |
| Activation UX | Open existing tenant forge prefilled with `?fromRegistration={id}`; superadmin reviews/edits, clicks Create |
| Bundle carry-over | Resolved modules array carried into tenant; bundle name shown in Backyard detail for context only |
| Rate limiting | In-memory IP limiter — 5/hr submit, 30/hr promo validate |

## Out of Scope (v1)

- Email notifications (deferred to post-Resend)
- Settings UI for bundles
- Self-serve activation
- reCAPTCHA
- Lead scoring / auto-prioritization

## Notable Edge Cases Resolved

1. Duplicate submissions: allowed, badge in list view counts priors by email
2. Promo expires between submit and activation: detail view re-validates live, prefill strips expired code
3. Activation partial failure (tenant created, promo commit failed): tenant stays live, "Retry promo" affordance on registration detail
4. Empty intent: form-level guard requires ≥1 module OR non-empty custom request

## Open Adaptation in Plan

- Task 13 (`commitPromoUsage` call): exact `CommitInput` shape needs to be read from `lib/modules/promo/api/commit.ts` at implementation time — registration-driven activation has no order/memberId, so may need a synthetic reference or facade extension.
- Task 12 (tenant forge prefill): setter names depend on existing `backyard/app/tenants/page.tsx` shape — read first, adapt.

## Status

Ready to implement. User chose to defer execution. When picking back up, use either subagent-driven-development or executing-plans against the plan file.
