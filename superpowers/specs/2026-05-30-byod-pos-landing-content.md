# BYOD POS — Landing/Info Page Content Spec

**Date:** 2026-05-30
**Status:** Approved (content + layout); ready as illustration & build guide
**Purpose:** Konten halaman `/byod_pos` yang mengenalkan apa itu BYOD POS sekaligus memamerkan fitur andalan. Dokumen ini jadi panduan untuk (a) menyiapkan image preview/ilustrasi, dan (b) menyusun blok di Canvas Studio.

---

## 1. Konteks & Keputusan

| Aspek | Keputusan |
|---|---|
| **POV / tujuan** | Campuran: kenalan ("apa itu BYOD POS") + pamer fitur. Buat calon user yang lagi nimbang. |
| **Audiens** | Café & casual dining (segmen inti modul). Tonjolkan self-order QR, KDS, open bill. |
| **Tone** | Santai-casual tapi cocok buat business owner. Kalimat pendek, nggak kaku, nggak terlalu gaul. Mengacu pada tone halaman referensi `/go/website-builder`. |
| **Tidak menyebut** | Klaim teknis stack (Firebase/Next.js dll) — tidak relevan untuk owner kafe. |
| **Pantangan** | Tidak pakai styling italic (preferensi user). Muted state pakai opacity/warna. |

**Referensi tone:** `http://localhost:3000/go/website-builder` — pola: hook besar → grid fitur (label kecil + judul + 1–2 kalimat santai) → blok penutup "Ini dia, [produk]…".

**Preview mockup:** `/tmp/byod-pos-preview/index.html` (statis, dark + aksen oranye **hanya untuk review**; halaman asli ikut theme tenant aktif).

---

## 2. Struktur Halaman (4 bagian)

```
1. HERO                — hook + ilustrasi besar
2. FEATURE CARDS       — 4 key-fact ringkas, kenalan istilah "BYOD"
3. CONTENT SHOWCASE    — 6 fitur naratif, alternating image-left/right
4. CLOSING             — blok "Ini dia, …" + 4 poin
```

**Pemilihan block (penting):**
- **Feature Cards** dipakai untuk **key facts** — title pendek + desc pendek + ilustrasi/ikon kecil. Cocok untuk ringkasan cepat.
- **Content Showcase** ([`components/blocks/public/DefaultContentShowcaseBlock.tsx`](../../clicker-platform-v2/components/blocks/public/DefaultContentShowcaseBlock.tsx)) dipakai untuk **6 fitur utama** — tiap fitur dapat ilustrasi besar + teks naratif yang lebih kebaca. **Jangan** pakai feature cards untuk 6 fitur ini.

---

## 3. Copy Final

### 3.1 Hero
- **Label chip:** `BYOD POS`
- **Judul:** Self Order POS, pelanggan pesan sendiri dari HP-nya
- **Subjudul:** Scan QR di meja, pilih menu, pesanan langsung masuk ke dapur. Kasir nggak kewalahan, antrian nggak numpuk, kamu tinggal masak & sajikan.

### 3.2 Feature Cards — "Jadi, BYOD itu apa?"
Intro section: **BYOD = Bring Your Own Device.** HP pelanggan jadi mesin pesannya. Nggak perlu beli tablet tiap meja, kasir nggak perlu nyatet manual.

| # | Title | Desc |
|---|---|---|
| 1 | Pakai HP Pelanggan | Mereka scan & pesan dari HP sendiri. Kamu nggak beli perangkat tambahan. |
| 2 | Bayar QRIS | Terima QRIS langsung. Cepat, nggak pegang uang receh. |
| 3 | Pajak PB1 Otomatis | Service charge & PB1 dihitung sendiri, sesuai aturan. |
| 4 | Sadar Jam Buka | Laporan ngikutin jam operasional, bukan jam 12 malam. |

### 3.3 Content Showcase — 6 fitur (alternating)
Section head: label `Fitur Andalan` · judul "Dari pelanggan pesan sampai laporan" · sub "Semuanya nyambung dalam satu alur."

`defaultLayout: 'alternate'` → row ganjil image-left, row genap image-right (otomatis, tidak perlu set per row).

| Row | Layout | Heading | Content |
|---|---|---|---|
| 1 | image-left | Pesan Sendiri dari Meja | Tempel QR di tiap meja. Pelanggan scan, lihat menu lengkap dengan foto, pesan langsung. Mau nambah ronde? Tinggal scan lagi, semua masuk ke satu tagihan meja. *(menyelipkan Open Bill)* |
| 2 | image-right | Layar Dapur Tanpa Kertas | Pesanan langsung nongol di layar dapur begitu pelanggan order. Nggak ada kertas kececeran, nggak ada salah dengar. Tinggal geser kalau udah selesai. |
| 3 | image-left | Kasir Lengkap, Bayar QRIS | Buat yang pesan di counter, kasir tetap siap. Terima QRIS, pajak PB1 & service charge dihitung otomatis — rapi, sesuai aturan, nggak perlu kalkulator. |
| 4 | image-right | Laporan yang Ngerti Jam Buka | Rekap penjualan harian, item terlaris, sampai breakdown cara bayar. Yang jualan sampai dini hari pun aman — laporannya ngikutin jam buka kamu, bukan jam 12 malam. |
| 5 | image-left | Poin Nambah Otomatis | Tiap pesanan kelar, poin pelanggan langsung nambah sendiri. Bikin yang nongkrong balik lagi, tanpa kamu ribet ngitung manual. |
| 6 | image-right | Stok Berkurang Sendiri | Setiap item kejual, stok langsung dipotong otomatis — sampai level varian. Nggak ada lagi "eh ternyata habis" pas pelanggan udah pesan. |

### 3.4 Closing
- **Judul:** Ini dia, BYOD POS — sistem pesan & bayar yang ngebantu kafe kamu jalan lebih lancar.
- **Sub:** Pelanggan pesan sendiri, dapur sat-set, kasir tenang.
- **4 poin:**
  1. **Pelanggan pesan sendiri, antrian berkurang** — HP mereka jadi menunya. Kasir fokus ke yang lain.
  2. **Dapur langsung tahu, nggak salah order** — KDS real-time, tanpa kertas.
  3. **Bayar QRIS, pajak otomatis** — PB1 & service charge beres, tinggal terima uang.
  4. **Semua kerekam rapi** — penjualan, stok, poin pelanggan — tercatat sendiri.

---

## 4. Daftar Ilustrasi yang Perlu Disiapkan

### Hero (1 besar)
- **hero** — Mockup HP menampilkan halaman menu + QR di atas meja kafe. Komposisi alur singkat (HP → dapur).

### Feature Cards (4 kecil / ikon)
Ikon/ilustrasi kecil, bisa berupa icon set konsisten:
- **fc-device** 📲 — HP pelanggan
- **fc-qris** 💳 — pembayaran QRIS
- **fc-pb1** 🧾 — struk/pajak
- **fc-hours** 🕒 — jam buka

### Content Showcase (6 besar — ini yang utama)
Aspect ratio mengikuti block default (`16:9`, `objectFit: cover`):
- **showcase-qr** — HP menampilkan menu grid + tombol "Tambah ke Pesanan", QR di meja.
- **showcase-kds** — Layar dapur dengan kartu-kartu order antri + status masak.
- **showcase-cashier** — Layar kasir: keranjang item + QR QRIS untuk bayar.
- **showcase-report** — Dashboard ringkas: angka penjualan + grafik + list item teratas.
- **showcase-loyalty** — Notifikasi "+poin" muncul setelah order selesai.
- **showcase-stock** — Angka stok turun real-time saat ada penjualan (level varian).

> **Gaya ilustrasi:** konsisten satu bahasa visual (mis. mockup UI bersih). 6 showcase adalah aset paling penting karena tampil besar.

---

## 5. Mapping ke Canvas Studio

| Bagian halaman | Block |
|---|---|
| Hero | Hero block (existing) |
| 4 key facts | **Feature Cards** block |
| 6 fitur | **Content Showcase** block — 1 instance, 6 `rows[]`, `defaultLayout: 'alternate'` |
| Closing | Feature cards / rich text block dengan 4 poin |

**Per row Content Showcase** = entry di `rows[]`:
- `media.src` → ilustrasi showcase (lihat §4)
- `heading.text` → judul fitur
- `content` → paragraf (boleh rich text HTML)
- `cta` → tidak dipakai (kosong) kecuali diputuskan lain

---

## 6. Catatan & Open Items

- **Open Bill** tidak jadi kartu/row tersendiri — diselipkan sebagai 1 kalimat di Row 1 (QR Order). Bisa diangkat jadi row terpisah bila diminta.
- **Label chip per row** ("QR Order", "Dapur", dst) di mockup hanya penanda visual; **Content Showcase asli tidak punya field label per row.** Bila ingin label tampil, lebur ke `heading.text` atau awal `content`. *(Belum diputuskan.)*
- **Theme:** warna final ikut theme tenant; dark + oranye di mockup bukan keputusan tema.
- **Belum diputuskan:** apakah halaman ini punya CTA (mis. "Coba sekarang" / "Hubungi Clicker") di hero atau closing.
