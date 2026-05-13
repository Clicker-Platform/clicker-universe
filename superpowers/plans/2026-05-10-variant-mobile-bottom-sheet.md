# Variant Selection Dialog — Mobile Bottom Sheet

**Date:** 2026-05-10
**Priority:** Low (UX polish)
**Estimated effort:** 30 min

## Problem

[VariantSelectionDialog.tsx](../../clicker-platform-v2/lib/modules/byod_pos/components/VariantSelectionDialog.tsx) uses a centered overlay modal on both desktop and mobile. On mobile, this is a usability anti-pattern — bottom sheets are the platform norm (closer to thumb, easier to dismiss with swipe-down, less disorienting).

## Reference

The pattern already exists in this codebase:
- [POSCategoryManagerModal.tsx](../../clicker-platform-v2/lib/modules/byod_pos/admin/menu/components/POSCategoryManagerModal.tsx) — uses `useIsMobile()` + `MobileBottomSheet` to render a bottom sheet on mobile and a centered modal on desktop.
- Component: [MobileBottomSheet](../../clicker-platform-v2/components/admin/blocks/MobileBottomSheet.tsx)
- Hook: [useIsMobile](../../clicker-platform-v2/hooks/useIsMobile.ts)

## Plan

1. Open [VariantSelectionDialog.tsx](../../clicker-platform-v2/lib/modules/byod_pos/components/VariantSelectionDialog.tsx)
2. Import `useIsMobile` and `MobileBottomSheet`
3. Extract the dialog body (header + variant list + footer hint) into a `content` JSX block
4. Branch on `isMobile`: render `MobileBottomSheet` wrapping `content` on mobile; keep current centered overlay on desktop
5. Pick a sensible height — `auto` if the variant count is small, capped (e.g. `60vh`) if 6+ variants

## Test

- iPhone viewport: open public order page → tap a variant item → confirms bottom sheet slides up from below
- Desktop: same flow → confirms centered dialog still appears
- Verify dismiss behaviors: tap outside, swipe down (mobile), X button

## Out of scope

- Animation tuning — accept whatever `MobileBottomSheet` ships with
- Refactoring `MobileBottomSheet` itself
