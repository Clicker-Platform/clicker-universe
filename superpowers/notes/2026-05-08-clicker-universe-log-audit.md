# Clicker Universe — Log & Data Audit

**Tanggal:** 2026-05-08  
**Scope:** Investigasi log Firebase Functions + Firestore data untuk 3 issue yang dilaporkan  
**Tools:** Firebase MCP (functions_get_logs, firestore_list_documents, firebase_get_security_rules)

---

## Issue 1 — Form Tidak Jalan → TERNYATA JALAN ✅

**Temuan:**  
Data Firestore di `sites/go/inbox` menunjukkan form sudah berfungsi normal. Ada banyak submission dari form "Contact Us" (formId: `Zl1lIdtC2zc1gkrZZHly`) sejak 6 Mei, semua tersimpan dengan status `new`.

**Sample data:**
```
formTitle: "Contact Us"
status: "new"
submittedAt: 2026-05-06T04:35:40Z
data: { name: "kukuh", email: "kukuhadafi99@gmail.com", message: "test resend" }
```

**Kemungkinan akar masalah yang dilaporkan:**  
Bukan form-nya yang tidak jalan, melainkan kemungkinan **notifikasi email/WA tidak terkirim** ke admin setelah submission masuk. Data tersimpan ke Firestore, tapi admin tidak dapat notifikasi sehingga merasa form "tidak jalan".

**Action:**  
Verifikasi apakah notifikasi WA/email untuk inbox submission sudah dikonfigurasi dan berjalan.

---

## Issue 2 — Reservation Klaim Promo Belum Jalan → FIXED ✅

**Update 2026-05-08:** Commit `d5c86b6` sudah di-merge ke `dev` dan `main`:
> `feat(reservation): wire promo into public booking + show promo on detail panel`

### Yang sudah jalan setelah fix:

- **`DetailsStep.tsx`** — render `PromoApplicator` di public booking form, hitung `finalPrice` setelah diskon
- **`BookingForm.tsx`** — persist `appliedPromo` ke booking doc, jalankan `commitPromoUsage` setelah booking berhasil dibuat
- **`BookingDetailPanel.tsx`** — tampilkan subtotal / promo / total di admin panel ketika `appliedPromo` ada

### Data konfirmasi dari Firestore (sebelum fix):

Booking dengan kode promo **MORECLICK** sudah berhasil tercatat:
```
bookingId: Z5gKafeoVOsp0mqd6lLS
customerName: Kevin Norway
totalPrice: 993.500 (dari 1.987.000 — diskon 50%)
appliedPromo: { label: "MORECLICK", discount: 993500 }
```

### Catatan: Klaim Voucher oleh Member (belum dikerjakan)

- Collection `sites/go/modules/promo/vouchers` masih kosong
- Semua promo bertrigger `"code"`, belum ada yang `trigger: "claim"`
- Fitur ini butuh admin membuat promo baru dengan `trigger: claim` di dashboard — bukan code fix

**3 Promo aktif di site `go`:**

| Nama | Kode | Trigger | Value | Status |
|------|------|---------|-------|--------|
| MORECLICK | MORECLICK | `code` | 50% | active |
| Weekend Ceria | WEEKEND25 | `code` | 25% | active |
| MoreFood Expo | CLICKERFOOD | `code` | 50% | expired 7 Mei |

---

## Issue 3 — firebase-admin Module Error → BUG NYATA 🔴

**Error dari log (2026-05-07T13:35:19Z):**
```
severity: ERROR
function: ssrclickerapps
event: cache.purge.failed
message: Failed to load external module firebase-admin-dad4ffcb29e15c29
         Cannot find module 'firebase-admin-dad4ffcb29e15c29'
         Route: /workspace/.next/server/app/api/admin/ai/credits/route.js
```

**Akar masalah:**  
Saat build dan deploy ke Firebase App Hosting, bundler (Turbopack) membundle `firebase-admin` dengan nama hash `firebase-admin-dad4ffcb29e15c29` alih-alih mengeksternalisasinya. Ini bertentangan dengan konfigurasi di `serverExternalPackages` di `next.config.mjs` yang seharusnya mencegah bundling.

**File terdampak:**
- `clicker-platform-v2/app/api/admin/ai/credits/route.ts` — mengimpor dari `@/lib/firebase-admin`
- `clicker-platform-v2/lib/firebase-admin.ts` — menggunakan `require('firebase-admin')` agar tidak di-bundle

**Dampak:**  
Route `/api/admin/ai/credits` gagal saat cache purge, berarti data AI credits tidak bisa diambil oleh admin dashboard.

**Action:**  
Verifikasi isi `next.config.mjs` — pastikan `firebase-admin` terdaftar di `serverExternalPackages`. Jika sudah ada tapi masih error, kemungkinan Turbopack di versi Next.js yang dipakai belum fully support `serverExternalPackages` dan perlu fallback ke webpack, atau upgrade Next.js.

---

## Semua Error di Log (Ringkasan)

**Periode:** 2026-05-07 hingga 2026-05-08  
**Function:** `ssrclickerapps` (Firebase App Hosting SSR)

Sebagian besar log ERROR **tidak memiliki pesan** — hanya metadata HTTP request. Ini adalah log Cloud Run request-level yang menandai response HTTP 4xx/5xx, bukan application error. Satu-satunya error bermakna adalah `firebase-admin` module di atas.

**Log bermakna yang ditemukan:**
| Timestamp | Severity | Message |
|-----------|----------|---------|
| 2026-05-07T13:35:19Z | ERROR | `firebase-admin-dad4ffcb29e15c29: Cannot find module` — cache.purge.failed |

---

## Prioritas Fix

| # | Issue | Prioritas | Estimasi |
|---|-------|-----------|----------|
| 1 | Notifikasi form inbox | Medium | Cek config WA/email notifikasi |
| 2 | Promo di booking form | ✅ Fixed | Commit d5c86b6 — dev & main |
| 2b | Klaim voucher `trigger:claim` | Low | Admin action, bukan code fix |
| 3 | `firebase-admin` bundle error | High | Fix `next.config.mjs` atau upgrade Next.js |
