# Promo Engine & Vouchers — User Guide

**Module:** Promotions  
**Admin path:** Dashboard → Promotions  
**Applies to:** POS, Reservation, Service Records

---

## Overview

The Promo Engine lets you create discount codes, auto-apply rules, and member vouchers. Discounts can be applied at any billing point — POS checkout, booking confirmation, or service invoicing.

**Two core concepts:**

| Concept | What it is |
|---|---|
| **Promo** | The rule — defines the discount, conditions, and who can use it |
| **Voucher** | A personal claim — issued to a specific member with a unique code |

---

## Part 1 — Initial Setup

### Step 1: Enable the Module

The Promotions module must be enabled for your site before it appears in the menu. Contact your admin or go to the Backyard dashboard to enable it.

### Step 2: Configure Settings

Go to **Promotions → Settings**

| Setting | Description | Example |
|---|---|---|
| **Voucher code prefix** | Prefix for all auto-generated voucher codes | `SALE` → codes look like `SALE-A3KP-7MNQ` |
| **Default voucher expiry (days)** | How many days a voucher stays valid after being issued | `30` |
| **Allow guest codes** | If off, only registered members can use promo codes | Toggle on/off |

Click **Save** when done.

---

## Part 2 — Creating Promos

Go to **Promotions → New Promo**

### Basic Fields

| Field | Description |
|---|---|
| **Name** | Internal label shown to staff, e.g. "Ramadan 20% Off" |
| **Description** | Optional notes about the promo |
| **Kind** | `Percent (%)` or `Fixed Amount (Rp)` |
| **Value** | The discount amount — `20` for 20%, or `50000` for Rp 50,000 |
| **Max Discount** | (Percent only) Cap the maximum discount — e.g. max Rp 100,000 even if order is large |

### Trigger Type

The trigger determines **how** the promo is activated:

| Trigger | How it works | Best for |
|---|---|---|
| **Code** | Cashier or customer types a code | Seasonal sales, influencer codes, one-time events |
| **Auto-apply** | Automatically applied when customer qualifies | Always-on member discount, happy hour |
| **Claim (points)** | Member spends loyalty points to get a voucher | Rewards redemption program |

> If trigger is **Code**, fill in the **Code** field (e.g. `RAMADAN20`). This is what cashiers and customers will enter.

> If trigger is **Claim**, fill in **Cost in Points** (how many points to spend) and optionally **Voucher Expiry Days**.

### Conditions

| Condition | Description |
|---|---|
| **Min Subtotal** | Order must be at least this amount before the discount applies |
| **Valid From / Valid Until** | Date window — leave blank for no expiry |
| **Eligible Sources** | Which modules can use this promo: POS, Reservation, Service Records (empty = all) |
| **Audience** | `Public` = anyone, `Members only` = logged-in members, `Specific members` = named member IDs |

### Usage Limits

| Field | Description |
|---|---|
| **Max Uses** | Total number of times this promo can be redeemed across all customers |
| **Per Member Limit** | How many times a single member can use it |

### Status

New promos are created as **Active**. You can:
- **Pause** — temporarily stop redemptions (can be re-activated)
- **Archive** — permanently retire (cannot be redeemed)

---

## Part 3 — Using Promo at POS

### Cashier Flow (Step by Step)

1. Build the customer's order as normal in the POS
2. Click **Pay** to open the payment dialog
3. In the **Promo / Discount Code** section, type the code (e.g. `RAMADAN20`) and click **Apply**
4. The discount is shown immediately:

```
Subtotal:   Rp 150,000
Discount:   - Rp 30,000   (Ramadan 20% Off)
─────────────────────────
Total:      Rp 120,000
```

5. Select the payment method (Cash / Card / QRIS)
6. Click **Confirm Payment**
7. Usage is recorded automatically — the promo's usage count increments

### Auto-Apply

If you have an **auto-apply** promo active, the payment dialog will automatically find and apply the best eligible discount when it opens — no code entry needed. The cashier can still remove it with the × button.

### Voucher Codes at POS

Voucher codes work exactly the same as promo codes — type the voucher code (e.g. `VCH-A3KP-7MNQ`) in the same field and click Apply. After payment, the voucher is marked as used and cannot be reused.

---

## Part 4 — Using Promo at Reservation

1. Go to **Reservation → New Booking** (admin booking wizard)
2. Complete all steps (select service, time, staff)
3. On the final step (Guest Details), the **Promo Code** field appears above the Confirm button
4. Enter the code and click **Apply** — the booking total updates
5. Click **Confirm Booking** — discount is applied to the booking price

---

## Part 5 — Using Promo at Service Records

1. Open a service record and click **Finalize Service** (or the bill/invoice button)
2. In the Finalize modal, the **Promo Code** section appears in the bill area
3. Enter the code and click **Apply**
4. The discounted total is used for the final invoice
5. Click **Complete** — discount is recorded on the service record

---

## Part 6 — Vouchers

Vouchers are personal discount codes issued to specific members. Unlike promo codes (which anyone can use), a voucher belongs to one member and can only be redeemed by them.

### Admin: Grant a Voucher Manually

1. Go to **Promotions → Vouchers**
2. Click **Grant Voucher**
3. Select the promo from the dropdown
4. Enter the **Member ID** and optionally their name
5. Click **Grant** — a unique voucher code is generated and stored

Share the code with the member (SMS, WhatsApp, email). They can also see it in their member dashboard.

### Member: Redeem Points for a Voucher

1. Member opens their dashboard (member portal)
2. The **My Rewards** section shows available promos with their point cost
3. Member clicks **Redeem** on a reward
4. Points are deducted and the voucher appears in **My Vouchers**
5. Member presents the code at checkout

### Admin: View & Manage Vouchers

Go to **Promotions → Vouchers** to see all vouchers with:
- Status: Active / Used / Expired
- Who it was issued to
- Which promo it came from
- When it was used and on which order

To cancel an active voucher, click **Revoke**.

---

## Part 7 — Managing Promos

### Promo List

Go to **Promotions** to see all promos with status tabs:

- **All** — full list
- **Active** — currently live
- **Paused** — temporarily stopped
- **Archived** — retired promos

### Actions per promo

| Action | When to use |
|---|---|
| **Edit** | Change conditions, dates, value |
| **Pause** | Temporarily stop — e.g. campaign ended but want to keep for reference |
| **Archive** | Permanently retire — removes from all active lists |
| **Delete** | Only available on archived promos |

---

## Quick Reference

### Common Setups

**Weekend flash sale (code)**
- Trigger: Code, Code: `WEEKEND10`
- Kind: Percent, Value: 10
- Valid From: Friday 00:00, Valid Until: Sunday 23:59
- Eligible Sources: POS

**Always-on member discount (auto)**
- Trigger: Auto-apply
- Kind: Percent, Value: 5
- Audience: Members only
- No date window, no usage cap

**Points reward voucher (claim)**
- Trigger: Claim, Cost in Points: 500
- Kind: Fixed, Value: 50000
- Voucher Expiry Days: 30

### Rules to Remember

- **One promo per transaction** — codes do not stack
- **Vouchers are personal** — only the member they were issued to can redeem them
- **Auto-apply picks the best** — if multiple auto promos qualify, the highest discount wins
- **Paused ≠ Archived** — paused promos can be re-activated; archived cannot
- **Snapshot protection** — editing a promo's value does not change already-issued vouchers
