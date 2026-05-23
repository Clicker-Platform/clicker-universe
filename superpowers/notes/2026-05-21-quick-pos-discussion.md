# Notes — Quick POS Discussion

**Date:** 2026-05-21 (paused 2026-05-22)
**Related spec:** `superpowers/specs/2026-05-21-quick-pos-block.md`
**Related memory:** `project_quick_pos_block.md`
**Status:** Paused before implementation

---

## How the idea evolved

### 1. Starting frustration
User opened the POS Menu block in Canvas Studio and felt it was too monolithic — "if add the block, it will just basically add a whole pos view into the page." No way to use POS for anything other than a dedicated ordering page.

### 2. First reframe — keep existing, add sibling
Important user clarification: **nothing is wrong with the existing block.** Don't refactor, don't split, don't deprecate. The ask is purely **additive**: a new, configurable block for a different purpose.

> "POS can be turned to touch point for 'a product checkout' with POS styles"

This reframed the problem from "fix the POS block" to "compose with POS plumbing."

### 3. Locked design (during session)
| Question | Answer |
|---|---|
| Item selection | Hand-pick by ID only. No category filter — "the goal is to cherry pick." |
| Capacity | 1..N items per block |
| Cart | Shared with full POS block on same page |
| Name | **Quick POS** (chosen over "POS Widget" — "Widget" overloaded internally) |
| Layout | Auto — 1 = big card, 2+ = responsive grid (2/3/4 cols). No knob. |

### 4. Spec written
See `superpowers/specs/2026-05-21-quick-pos-block.md`. Covers files to create/modify, data flow, verification checklist.

### 5. Bigger context surfaced at the end (UNRESOLVED)
User shared the *real* driver — local burger shops wanting gofood-style online ordering:
- Customer orders remotely (not at counter / not at table)
- Needs delivery address + phone
- Needs **self-pay** before order is accepted (not "confirm at counter")
- Shop receives in KDS, prepares, dispatches courier

This is a **new POS mode** ("Online Order"), not just a new block. Current BYOD POS assumes physical presence; this needs:
- Address capture in checkout
- Self-pay payment gateway integration (QRIS link, etc.)
- Courier handoff status in KDS lifecycle
- POS settings toggle to enable the mode

**Open question parked for next session:**
- **(1) Narrow:** Build Quick POS as specified (placement only, dine-in/takeaway checkout). Online Order mode is a separate, larger initiative. Quick POS benefits later when mode exists.
- **(2) Bundled:** Treat Quick POS + Online Order as one initiative — burger-shop scenario needs both to be useful.

**Assistant's recommendation:** #1 (narrow). They're independent capabilities that compose. Bundling risks scope creep on a block that should stay simple.

**User did not confirm before pausing.**

---

## Why I'm capturing this here (not just in the spec)

The spec has the *what* — the locked design. This notes file has the *why* and the *open thread*. When resuming, read this first to remember:
1. The user explicitly wanted Quick POS to stay additive (don't touch `pos_menu_grid`)
2. The real driver is online ordering for delivery — the spec as written does **not** solve that on its own
3. There's a decision still owed before writing the implementation plan

---

## What to do when resuming

1. Re-read the spec (`specs/2026-05-21-quick-pos-block.md`)
2. Re-read this notes file
3. Ask the user: **narrow or bundled?** (#1 vs #2 above)
4. If narrow → write implementation plan, proceed
5. If bundled → brainstorm Online Order mode separately first (likely its own spec), then sequence: Online Order mode → Quick POS that consumes it

Don't start coding until the narrow-vs-bundled question is answered.
