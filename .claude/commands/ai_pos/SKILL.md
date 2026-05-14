---
name: ai_pos
description: >
  Work with the Clicker Platform AI BYOD POS features — Phase 1.
  Use this skill whenever adding, modifying, or debugging AI features embedded in the BYOD POS module.
  Trigger on: "ai pos", "pos ai", "notes parser", "cashier insights", "menu description generator",
  "favorit hari ini", "pos report ai", "nl query pos", "customer chat pos",
  "lib/modules/byod_pos/ai", "app/api/pos-ai", "AI yang Ngerti Bisnis".
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.
> **Design Spec:** [`dev/superpowers/specs/2026-05-13-ai-byod-pos-phase1-design.md`](../../../superpowers/specs/2026-05-13-ai-byod-pos-phase1-design.md)

# /ai_pos — AI BYOD POS Features

**Vision:** "AI yang Ngerti Bisnis Anda — Analisa laporan, prediksi stok, otomatisasi promo, bukan sekadar balas chat."

AI features embedded into existing BYOD POS module. **Additive only** — tidak merubah order flow, payment logic, atau revenue calculation.

---

## 1. Architecture — Hybrid Orchestrator

```
lib/ai/                          ← Global (EXISTING)
  client.ts                      ← callText(), callWithTools(), callVision()
  models.ts                      ← Model config dari Backyard AI Settings
  credits.ts                     ← Credit tracking
  orchestrator.ts                ← NEW: rate limiting, credit check, shared utilities

lib/modules/byod_pos/ai/         ← NEW: POS-specific domain
  agents.ts                      ← Agent definitions per usecase
  context.ts                     ← Fetch & build POS context dari Firestore
  prompts.ts                     ← System prompt templates per feature

app/api/pos-ai/                  ← NEW: API routes (server-side only)
  report/route.ts                ← R1 Executive Summary, R2 Item Performance, R3 Anomali
  query/route.ts                 ← R4 Natural Language Query
  cashier/route.ts               ← C1 Cashier Insights
  chat/route.ts                  ← P1 Customer Chat
  menu-desc/route.ts             ← M4 Menu Description Generator
  notes-parse/route.ts           ← K1 Notes Parser
```

**Rules:**
- Semua AI calls HARUS via API routes — TIDAK BOLEH direct call dari client component
- Model resolve dari `lib/ai/models.ts` → Backyard AI Settings — TIDAK BOLEH hardcode model name
- Cross-module data (membership, inventory) via `isModuleEnabled` + dynamic import
- Pakai `callText()` untuk narasi, `callWithTools()` untuk R4 NL Query

---

## 2. Feature Map — Phase 1

| ID | Fitur | Lokasi UI | API Route | Effort |
|----|-------|-----------|-----------|--------|
| K1 | Notes Parser | `KDSClient` + `POSOrderCard` | `notes-parse/` | Low |
| C1 | Cashier Insights | `CashierClient` | `cashier/` | Low |
| R1 | Executive Summary | `POSClient` (Reports) | `report/` | Low |
| R2 | Item Performance | `POSClient` (Reports) | `report/` | Low |
| R3 | Revenue Anomali | `POSClient` (Reports) | `report/` | Low |
| R4 | NL Query | `POSClient` (Reports) | `query/` | Medium |
| M4 | Menu Desc Generator | `POSMenuItemDialog` | `menu-desc/` | Low |
| P1 | Customer Chat + Favorit | `OrderPage` + `MenuGrid` | `chat/` | Medium |

---

## 3. Feature Specs

### K1 — AI Order Notes Parser

**Trigger:** Order masuk KDS dengan `items[].notes` tidak kosong  
**Input:** `{ notes: string, itemName: string }`  
**Output:** `{ modifiers: string[], cookingInstructions: string[], originalNote: string }`

**Rules:**
- Multi-language: Indonesia + English + bahasa gaul → AI handle natural
- Badges flat di `POSOrderCard` — TIDAK ADA severity level / alergi flag
- Staff tap "Got it" sebelum advance order status
- `parsedNotes` field di `CartItem` — optional, backward compatible
- Original note selalu disimpan, bisa di-expand di UI

---

### C1 — AI Cashier Insights

**Trigger:** Auto-load saat `CashierClient` dibuka, refresh tiap 15 menit  
**Data:** Orders dari state `subscribeToRecentOrders` + historis dari `api-reports.ts`  
**Output:** Narasi 1–2 kalimat shift summary + anomali  
**UI:** Card kecil collapsed by default — tidak blocking cashier flow

---

### R1 + R2 + R3 — Report AI (sama route `report/`)

**R1 Executive Summary**
- Data: `getDailyReport()` + `getReportStats()` dari `api-reports.ts`
- Output: Narasi revenue + highlight + peak hour
- UI: Section paling atas halaman report, loading skeleton, refresh button

**R2 Item Performance**
- Data: `getItemsSales()` dari `api-reports.ts`
- Output: Star items ⭐ / Dead weight 🔍 / Bundle opportunity 🔗
- UI: List card dengan badge per kategori

**R3 Revenue Anomali**
- Logic: Avg per hari-dalam-seminggu rolling 4 minggu → flag deviasi > 30%
- Output: Alert narasi anomali
- UI: Alert card kuning dismissible di bawah chart

---

### R4 — Natural Language Query

**Pattern:** `callWithTools()` — AI decide tool mana yang dipanggil  
**Tools tersedia untuk AI:**
```ts
get_daily_report(date: string)
get_items_sales(startDate: string, endDate: string)
get_report_stats(startDate: string, endDate: string)
compare_periods(period1: object, period2: object)
```
**UI:** Input bar di atas halaman report → jawaban inline. History per session (tidak persisted).

---

### M4 — Menu Description Generator

**Trigger:** Admin klik "Generate dengan AI" di `POSMenuItemDialog`  
**Input:** `{ name: string, category: string, price: number, variants?: string[] }`  
**Output:** Deskripsi 1–2 kalimat Bahasa Indonesia  
**Flow:** Generate → tampil di textarea (editable) → admin edit → Save seperti biasa  
**PENTING:** AI sebagai draft helper, bukan auto-save. Admin tetap full control.

---

### P1 — Customer Chat + "Favorit Hari Ini"

#### P1a — "Favorit Hari Ini" Section

Tampil di atas `MenuGrid` untuk SEMUA customer (tanpa login).

**Fallback chain — WAJIB diikuti:**
```
1. getItemsSales(siteId, today)        → label "Favorit Hari Ini"
2. getItemsSales(siteId, last7days)    → label "Menu Populer"
3. getItemsSales(siteId, last30days)   → label "Menu Populer"
4. Tidak ada data                      → section tidak tampil (tidak ada empty state)
```

Label UI menyesuaikan ketersediaan data. Horizontal scroll card top 5 item + "Add to Cart" langsung.

#### P1b — AI Customer Chat

**Pattern:** Reuse `ChatWidget` dari `ai-sales-agent` — ganti system prompt ke POS context  
**Context di-fetch sekali saat widget dibuka (cached):**
- Menu items + harga dari `modules/byod_pos/menu_items`
- Kategori aktif dari `settings/config`
- Item terlaris 7 hari dari `getItemsSales()`

**Fungsi:** Escape hatch dari "Favorit Hari Ini" — customer dengan preferensi spesifik tanya langsung ke AI.

**CATATAN Phase 1:** Member personalisasi (P4) di-skip — member self-login di public OrderPage belum ada. Masuk Phase 2.

---

## 4. Critical Rules

- **TIDAK BOLEH** direct AI call dari client component — semua via `app/api/pos-ai/`
- **TIDAK BOLEH** hardcode model name — pakai `getModel()` dari `lib/ai/models.ts`
- **TIDAK BOLEH** modifikasi `api.ts`, `api-reports.ts`, `api-admin.ts` — hanya dibaca
- **TIDAK BOLEH** merubah order flow atau payment logic
- `parsedNotes` di `CartItem` HARUS optional + backward compatible
- Rate limiting HARUS di `lib/ai/orchestrator.ts` — per siteId per feature
- Auto-generate features (R1, R2, R3, C1) HARUS pakai cache — tidak re-generate tiap page load

---

## 5. File Map

### New Files
```
lib/ai/orchestrator.ts
lib/modules/byod_pos/ai/agents.ts
lib/modules/byod_pos/ai/context.ts
lib/modules/byod_pos/ai/prompts.ts
app/api/pos-ai/report/route.ts
app/api/pos-ai/query/route.ts
app/api/pos-ai/cashier/route.ts
app/api/pos-ai/chat/route.ts
app/api/pos-ai/menu-desc/route.ts
app/api/pos-ai/notes-parse/route.ts
```

### Modified Files
```
lib/modules/byod_pos/types.ts                              ← parsedNotes optional di CartItem
lib/modules/byod_pos/admin/KDSClient.tsx                   ← K1 trigger + UI
lib/modules/byod_pos/admin/components/POSOrderCard.tsx     ← K1 badges + Got it button
lib/modules/byod_pos/admin/CashierClient.tsx               ← C1 insights panel
lib/modules/byod_pos/admin/POSClient.tsx                   ← R1, R2, R3, R4 UI sections
lib/modules/byod_pos/admin/menu/components/POSMenuItemDialog.tsx  ← M4 generate button
lib/modules/byod_pos/public/OrderPage.tsx                  ← P1 ChatWidget + Favorit section
lib/modules/byod_pos/components/MenuGrid.tsx               ← P1a rekomendasi cards
```

---

## 6. Phase 2 (Not in Scope)

- P4 Member Personalisasi (tunggu member self-login di public page)
- K2 Prep Time Estimator
- K3 Queue Optimizer
- B1 Daily Digest Email
- B2 Low Performance Alert
- B3 Inventory Forecast
- R5 Time Heatmap
- R7 Promo Effectiveness
