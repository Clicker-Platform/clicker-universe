# AI BYOD POS — Phase 1 Design Spec

**Date:** 2026-05-13  
**Vision:** "AI yang Ngerti Bisnis Anda — Analisa laporan, prediksi stok, otomatisasi promo, bukan sekadar balas chat."  
**Scope:** 8 AI features embedded into existing BYOD POS module  
**Status:** Awaiting implementation plan

---

## 1. Background & Goals

BYOD POS sudah punya data yang kaya: orders, menu items, member history, payment methods, shift data. Tapi semua data ini hanya tampil sebagai angka — owner dan staff harus interpretasi sendiri.

Phase 1 goal: surface AI insight di setiap touchpoint POS yang sudah ada tanpa merubah existing order/payment logic.

**Non-goals:**
- Tidak merubah order flow
- Tidak merubah payment logic
- Tidak merubah Firestore schema (kecuali 1 optional field)
- Tidak butuh ML model baru atau vector DB

---

## 2. Architecture

### 2.1 Hybrid Orchestrator Pattern

```
lib/ai/                          ← Global (sudah ada)
  client.ts                      ← OpenRouter calls (callText, callWithTools, callVision)
  models.ts                      ← Model config dari Firestore via Backyard AI Settings
  credits.ts                     ← Credit tracking
  orchestrator.ts                ← NEW: shared utilities, context builder, rate limiting

lib/modules/byod_pos/ai/         ← NEW: POS-specific domain
  agents.ts                      ← Agent definitions per usecase
  context.ts                     ← Fetch & build POS context dari Firestore
  prompts.ts                     ← System prompt templates
```

**Prinsip:**
- `lib/ai/orchestrator.ts` = shared infra (credits, logging, rate limit, context builder utility)
- `lib/modules/byod_pos/ai/` = domain logic POS saja
- Cross-module data (member, inventory) via `isModuleEnabled` + dynamic import — sama seperti pattern di `api.ts`

### 2.2 Data Flow

```
AI Feature trigger (user action / page load)
  → byod_pos/ai/context.ts: fetch relevant Firestore data
  → byod_pos/ai/prompts.ts: build system prompt dengan context
  → lib/ai/orchestrator.ts: rate limit check + credit check
  → lib/ai/client.ts: callText() / callWithTools()
  → OpenRouter → model (dikonfigurasi via Backyard)
  → Response → UI component
```

### 2.3 API Routes

Semua AI calls via Next.js API routes (server-side) — tidak ada direct AI call dari client component:

```
app/api/pos-ai/
  report/route.ts          ← R1, R2, R3
  query/route.ts           ← R4 NL Query
  cashier/route.ts         ← C1 Cashier Insights
  chat/route.ts            ← P1 Customer Chat
  menu-desc/route.ts       ← M4 Menu Description Generator
  notes-parse/route.ts     ← K1 Notes Parser
```

---

## 3. Feature Specs

### K1 — AI Order Notes Parser

**Lokasi:** `KDSClient.tsx` + `POSOrderCard.tsx`  
**Trigger:** Order masuk ke KDS dengan field `notes` tidak kosong  
**Effort:** Low

**Flow:**
1. Order baru masuk via `subscribeToRecentOrders`
2. Jika `items[].notes` ada → call `POST /api/pos-ai/notes-parse`
3. API parse free-text → structured modifiers
4. Tampil sebagai badges di `POSOrderCard`

**Input:**
```ts
{ notes: string, itemName: string, language: 'id' | 'en' | 'mixed' }
```

**Output:**
```ts
{
  modifiers: string[],        // ["No Bawang", "Less Sweet", "Nasi Dipisah"]
  cookingInstructions: string[], // ["Jangan Gosong"]
  originalNote: string        // tetap disimpan
}
```

**UI di KDS:**
- Modifier badges flat (kuning/abu) per item — tidak ada severity level
- Staff tap "Got it" sebelum advance status order
- Original note tetap bisa di-expand

**Schema change:** Tambah optional `parsedNotes` ke `CartItem` type — backward compatible.

**Multi-language:** Gemini handle Indonesia + English + bahasa gaul secara natural.

---

### C1 — AI Cashier Insights

**Lokasi:** `CashierClient.tsx` — panel kecil di atas atau sidebar  
**Trigger:** Auto-load saat cashier buka halaman, refresh tiap 15 menit  
**Effort:** Low

**Data yang digunakan:**
- Orders dari `subscribeToRecentOrders` (sudah ada di state)
- Rata-rata historis dari `api-reports.ts`

**Output narasi:**
> "Shift berjalan 3 jam. Revenue Rp 1.2jt dari 24 order. Lebih ramai 15% dari rata-rata jam segini."

> "3 order menunggu pembayaran lebih dari 10 menit."

**UI:** Card kecil collapsed by default, expand untuk detail. Tidak blocking cashier flow.

---

### R1 — AI Executive Summary

**Lokasi:** `/admin/pos/reports` — section paling atas  
**Trigger:** Auto-generate saat halaman dibuka  
**Effort:** Low

**Data source:** `getDailyReport()`, `getReportStats()` dari `api-reports.ts` yang sudah ada.

**Output:**
> "Hari ini revenue Rp 2.4jt, naik 18% dari kemarin. Peak jam 12–13. Kopi Susu jadi item terlaris pertama kalinya minggu ini."

**UI:** Text block dengan loading skeleton. Refresh button manual.

---

### R2 — AI Item Performance Analysis

**Lokasi:** `/admin/pos/reports` — section Item Performance  
**Trigger:** Auto-generate saat tab dibuka  
**Effort:** Low

**Data source:** `getItemsSales()` dari `api-reports.ts`.

**Output:**
- Star items: *"Nasi Goreng — 142 pesanan minggu ini. Pertahankan."*
- Dead weight: *"Jus Alpukat — 3 pesanan bulan ini. promo khusus."*
- Bundle opportunity: *"Kopi Susu sering dipesan bareng Roti Bakar (68%). Pertimbangkan bundle."*

**UI:** List card dengan badge status (Star ⭐ / Review 🔍 / Bundle 🔗).

---

### R3 — AI Revenue Anomali Detection

**Lokasi:** `/admin/pos/reports` — inline di revenue chart  
**Trigger:** Auto-detect saat data loaded  
**Effort:** Low

**Logic:**
- Hitung avg revenue per hari-dalam-seminggu (rolling 4 minggu)
- Flag hari yang deviasi > 30% dari avg
- AI generate narasi anomali

**Output:**
> "Kamis kemarin revenue turun 40% dari rata-rata Kamis. Apakah ada kejadian khusus?"

**UI:** Alert card kuning di bawah chart. Dismissible.

---

### R4 — Natural Language Query

**Lokasi:** `/admin/pos/reports` — search bar di atas halaman  
**Trigger:** Owner ketik pertanyaan → submit  
**Effort:** Medium

**Pattern:** `callWithTools()` — AI decide data apa yang perlu di-fetch sebagai tool calls.

**Tools yang tersedia untuk AI:**
```ts
get_daily_report(date: string)
get_items_sales(startDate: string, endDate: string)
get_report_stats(startDate: string, endDate: string)
compare_periods(period1: object, period2: object)
```

**Contoh:**
- Owner: *"Berapa revenue weekend bulan ini?"*
- AI: tool call `get_report_stats` filter weekend → *"Weekend Oktober total Rp 18.4jt, rata-rata Rp 2.3jt per hari."*

**UI:** Input bar + jawaban inline di bawah. History query per session (tidak persisted).

---

### M4 — AI Menu Description Generator

**Lokasi:** `POSMenuItemDialog.tsx` — field deskripsi  
**Trigger:** Admin klik tombol "Generate dengan AI"  
**Effort:** Low

**Input ke AI:**
```ts
{ name: string, category: string, price: number, variants?: string[] }
```

**Output:** Deskripsi 1–2 kalimat dalam Bahasa Indonesia, menarik, informatif.

**Flow:**
1. Admin klik "Generate dengan AI"
2. Loading state di textarea
3. AI generate → tampil di textarea (editable)
4. Admin baca, edit kalau perlu → Save seperti biasa

**UI:** Tombol kecil di sebelah field deskripsi. Textarea tetap editable setelah generate.

---

### P1 — AI Customer Chat + "Favorit Hari Ini"

**Lokasi:** Public `OrderPage` — floating button + section rekomendasi di atas `MenuGrid`  
**Trigger:** Auto-load saat OrderPage dibuka (rekomendasi) + customer klik chat button (chat)  
**Effort:** Medium

#### P1a — "Favorit Hari Ini" Section

Section rekomendasi otomatis di atas MenuGrid — tampil untuk semua customer tanpa login.

**Fallback chain (data source):**
```
1. getItemsSales(siteId, today)        → label "Favorit Hari Ini"
2. getItemsSales(siteId, last7days)    → label "Menu Populer"
3. getItemsSales(siteId, last30days)   → label "Menu Populer"
4. Tidak ada data sama sekali          → section tidak tampil (MenuGrid langsung)
```

**UI:** Horizontal scroll card top 5 item. Bisa langsung "Add to Cart" dari card. Label section menyesuaikan ketersediaan data.

**Note:** P4 Member Personalisasi di-drop dari Phase 1 — member self-login di public page belum tersedia. Masuk Phase 2.

#### P1b — AI Customer Chat

**Pattern:** Reuse `ChatWidget` dari `ai-sales-agent` module dengan POS-specific system prompt.

**Context yang di-fetch saat widget dibuka (sekali, cached):**
| Data | Source |
|------|--------|
| Menu items + harga | `modules/byod_pos/menu_items` |
| Kategori aktif | `settings/config` |
| Item terlaris 7 hari | `getItemsSales()` |

**System prompt template:**
```
Kamu adalah asisten pemesanan untuk {businessName}.
Menu tersedia:
{menuItems}

Item terlaris minggu ini: {topItems}

Bantu customer pilih menu, jawab pertanyaan, dan rekomendasikan item yang sesuai.
Jika customer setuju pesan, konfirmasi item dan arahkan ke keranjang.
Jawab dalam Bahasa Indonesia.
```

**Fungsi:** Escape hatch dari rekomendasi otomatis — customer dengan preferensi spesifik (tidak pedas, vegetarian, budget tertentu) bisa tanya langsung ke AI.

**UI:** Floating button pojok kanan bawah → chat drawer slide up. Badge unread count.

---

## 4. Tech Stack

| Komponen | Detail |
|----------|--------|
| AI Engine | OpenRouter via `lib/ai/client.ts` |
| Model | Dikonfigurasi di Backyard → AI Settings (tidak hardcode) |
| API Routes | Next.js App Router (`app/api/pos-ai/`) |
| Data source | Existing `api-reports.ts`, `api.ts` functions |
| New Firestore fields | `CartItem.parsedNotes` (optional, backward compatible) |
| Cross-module data | `isModuleEnabled` + dynamic import (membership, inventory) |

---

## 5. Credit & Cost Considerations

- Semua AI calls tracked via `lib/ai/credits.ts`
- Rate limiting di `lib/ai/orchestrator.ts` — per siteId, per feature
- Auto-generate features (R1, R2, R3, C1) pakai cache: tidak re-generate tiap page load jika data belum berubah
- P1 Customer Chat = per-message cost → tampilkan credit usage indicator ke owner di settings

---

## 6. What Does NOT Change

- Order creation flow
- Payment confirmation flow
- Revenue calculation logic
- Existing Firestore schema (kecuali `CartItem.parsedNotes` optional)
- `api-reports.ts`, `api.ts` — hanya dibaca, tidak dimodifikasi
- Module registration (`definitions.ts`, `components.tsx`)

---

## 7. File Map — New Files

```
lib/ai/
  orchestrator.ts                    ← NEW

lib/modules/byod_pos/ai/
  agents.ts                          ← NEW
  context.ts                         ← NEW
  prompts.ts                         ← NEW

app/api/pos-ai/
  report/route.ts                    ← NEW (R1, R2, R3)
  query/route.ts                     ← NEW (R4)
  cashier/route.ts                   ← NEW (C1)
  chat/route.ts                      ← NEW (P1)
  menu-desc/route.ts                 ← NEW (M4)
  notes-parse/route.ts               ← NEW (K1)
```

## 8. File Map — Modified Files

```
lib/modules/byod_pos/types.ts        ← Tambah parsedNotes ke CartItem
lib/modules/byod_pos/admin/KDSClient.tsx         ← K1 UI
lib/modules/byod_pos/admin/components/POSOrderCard.tsx  ← K1 badges
lib/modules/byod_pos/admin/CashierClient.tsx     ← C1 panel
lib/modules/byod_pos/admin/POSClient.tsx         ← R1, R2, R3, R4 UI
lib/modules/byod_pos/admin/menu/components/POSMenuItemDialog.tsx  ← M4 button
lib/modules/byod_pos/public/OrderPage.tsx        ← P1 ChatWidget + Favorit Hari Ini section
lib/modules/byod_pos/components/MenuGrid.tsx     ← P1 rekomendasi cards
```

---

## 9. Phase 2 (Not in Scope Now)

- P4 Member Personalisasi — tunggu member self-login di public OrderPage
- K2 Prep Time Estimator
- K3 Queue Optimizer
- B1 Daily Digest Email
- B2 Low Performance Alert
- B3 Inventory Forecast
- R5 Time Heatmap
- R7 Promo Effectiveness
