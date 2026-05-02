# Clicker One-Pager — Spec

**Date:** 2026-04-28
**Type:** One-page written summary (markdown document, ~1 printed page)
**Audience:** Three lenses inside one document — general public, investors, business owners
**Tone:** Warm but premium — plain language, no jargon
**Positioning:** All-in-one operating system for SMEs (breadth as the wedge)
**Companion to:** `2026-04-26-clicker-intro-deck.md`

---

## Purpose

A single shareable document that explains what Clicker is to anyone who picks it up — without requiring a presentation, a demo, or prior context. The reader self-selects into the lens that fits them.

---

## Structure

1. Title + tagline
2. One-line positioning statement
3. "What Clicker is" — 2–3 sentence plain-language definition
4. **For Anyone** — the human story (~80 words)
5. **For Investors** — the business case (~80 words)
6. **For Business Owners** — what you get + how to start (~80 words)
7. Module strip — single line listing modules
8. Footer — CTA + URL

Total: fits on one printed A4 page.

---

## Content

```markdown
# Clicker — Run your business, not your apps.

**The all-in-one operating system for small and medium businesses.**

Clicker gives every business its own website, point-of-sale, booking system,
loyalty program, CRM, and AI sales agent — under one login, under one brand.
No more juggling five apps to run one business.

---

### 👤 For Anyone

Most small businesses today run on a patchwork: WhatsApp for orders, a spreadsheet
for inventory, a different app for bookings, another for receipts, and no real
website. Owners spend more time switching tabs than serving customers. Clicker
replaces the patchwork with one place — so the café owner, the salon manager,
the workshop foreman can stop wrestling tools and get back to running their
business.

### 📈 For Investors

Clicker is a modular, multi-tenant SaaS platform targeting Indonesia's millions
of underserved SMEs in F&B, beauty, automotive, retail, and services. The wedge
is breadth: instead of competing with single-feature apps, we replace the whole
stack. Revenue expands as customers turn on more modules — POS, loyalty, AI
agent, marketing — without a new vendor or a new login. Each tenant runs on
their own branded surface, which deepens switching costs and makes Clicker the
default infrastructure under their business.

### 🏪 For Business Owners

You get a professional website, a phone-based POS with kitchen display,
online bookings, a loyalty program, customer records, an AI agent that answers
questions while you sleep, and inventory that updates itself — all branded as
*your* business, not ours. Start with the one or two modules you need today.
Turn on the rest as you grow. No developers. No contracts to stitch together.
One platform that grows with you.

---

**Inside Clicker:** Website Builder · Point of Sale + Kitchen Display · Reservations
· Membership & Loyalty · Inventory · Sales Pipeline (CRM) · Service Records ·
AI Sales Agent · AI Marketing

---

*Ready to run your business, not your apps?* → **clicker.id**
```

---

## Layout Notes (for designer handoff)

- **Page size:** A4 portrait, single page
- **Hero (top ~15%):** Tagline in large display weight; positioning sub-line in regular weight directly below
- **"What Clicker is" block (~10%):** Slightly indented, italic or muted treatment so it reads as a definition rather than body copy
- **Three lenses (~55%):** Stacked vertically, OR three equal columns if page width allows. Each lens header bold with its icon (👤 / 📈 / 🏪), body in regular weight. **Equal visual weight across all three** — no lens should dominate.
- **Module strip (~10%):** Single line, mid-weight, dot separators (·). Optionally replace with a horizontal row of small module icons.
- **Footer (~10%):** Centered. Italic tagline question + bold URL.
- **Visual tone:** Warm but premium, matching the intro deck. Generous whitespace. **One accent color** (Clicker brand) used sparingly — on lens headers and the URL only.
- **Typography:** Same family as the intro deck for consistency. Display weight for the title; regular weight throughout the body.

---

## Editorial Decisions (locked)

- **Geography named:** "Indonesia" stays in the investor lens — geographic focus is part of the story, not a limitation to hide.
- **Module naming:** "Point of Sale" used in body copy instead of "BYOD POS" — clearer for non-technical readers. Module strip uses friendly names throughout.
- **No pricing, no traction numbers, no competitor comparison** — matches the intro deck's out-of-scope rules. This is a positioning document, not a sales sheet.

---

## Out of Scope

- Pricing tiers
- Traction metrics, customer counts, revenue figures
- Competitor comparisons
- Technical architecture (multi-tenancy, Firebase, modules registry, etc.)
- Detailed feature documentation
- Founder bios or team slide
