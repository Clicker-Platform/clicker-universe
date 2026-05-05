# AI UI Brand Voice — Clarification

**Date:** 2026-05-06
**Supersedes the scope of:** the 2026-05-01 *"No AI-flavored UI elements"* rule (which removed a Sparkles + "Auto-apply best promo" button from PromoApplicator).

---

## The Distinction

There are two very different things that can wear an "AI" label, and Clicker treats them differently:

| Feature type | What it is | UI treatment |
|---|---|---|
| **Rule-based automation** | Plain `if/else`, threshold checks, deterministic logic dressed up with a sparkle to seem fancy | **No sparkle. No "AI" label. Run silently.** |
| **Real LLM-backed AI Booster** | Calls Claude / GPT / Gemini through OpenRouter, consumes customer AI credits, returns generated/analyzed content | **Use Clicker's locked AI brand: "AI: ..." card or "AI [Action]" button** |

---

## Why the Distinction Matters

**For rule-based features:** Putting a sparkle ✨ on plain logic is cosplay. It looks like a demo or prototype, and users see through it. The original objection — *"I hate it"* on the PromoApplicator button — was specifically that the feature was not actually AI.

**For real AI features:** Customers pay credits for every AI call. They *must* see clearly when they're invoking AI, or the credit/billing model breaks. Hiding the AI label would make tenants confused about why their credit balance is dropping.

The Clicker marketing materials (May 2026) lock the brand voice for real AI:

- **"AI: ..." prefixed yellow alert cards** for proactive insights
  - *"AI: Stok Arabica hampir habis. Reorder sekarang?"*
  - *"AI: 12 member belum transaksi 30 hari terakhir. Kirim promo?"*
  - *"AI: Chicken Wings terjual 28× hari ini. Stok tersisa 4 porsi."*
- **"AI [Action]" pink/branded buttons** for on-demand generation
  - *"AI Content Writer"*, *"AI Laporan Harian"*, *"AI Kirim Pengingat"*

This is the brand. Real AI features must use it.

---

## Practical Rules for Implementers

### When building a UI feature, ask: *"Does this call an LLM through OpenRouter and consume AI credits?"*

**No → Rule-based / silent automation:**
- No sparkle icons
- No "AI-powered" / "Smart" / "Magic" labels
- No magic-wand buttons
- Run the logic invisibly; surface only the outcome

**Yes → Real AI Booster:**
- Use the "AI: ..." prefix on insight cards (yellow alert pattern)
- Use the "AI [Action]" pattern on user-triggered buttons (pink/branded)
- Make it visually obvious that this action will spend credits
- Show credit cost up-front when reasonable

---

## Anti-patterns (don't do these)

- ❌ Sparkles on a `findBestPromo()` rule-based function and calling it "AI"
- ❌ Hiding a real LLM call behind a generic button labeled "Suggest" with no AI indicator
- ❌ Mixing patterns — half-real half-fake "AI assistant" branding on rule-based logic
- ❌ Using sparkle ✨ icons anywhere — even on real AI. Clicker's brand uses the "AI:" text prefix and color-coded card, not generic sparkle iconography.

---

## Reference

This clarification was made during the AI Boosters Initiative brainstorm — see [`2026-05-06-ai-boosters-brainstorm.md`](2026-05-06-ai-boosters-brainstorm.md) for the broader context and brand voice locked-in from clicker.id marketing materials.
