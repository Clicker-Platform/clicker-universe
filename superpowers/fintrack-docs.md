# fintrack — Personal Finance Tracker
> Modul keuangan personal dalam ekosistem **Clicker**
> AI-powered expense tracker dengan scan struk otomatis

---

## 📋 Overview

**fintrack** adalah modul pencatatan keuangan personal yang terintegrasi dalam ekosistem Clicker. Pengguna dapat mencatat transaksi secara manual atau dengan **scan struk/receipt via AI** yang otomatis mengisi form.

```
Module ID  : fintrack
Display    : Fintrack
Tagline    : Catat. Pantau. Cuan.
Platform   : Mobile + Web
AI Feature : Scan struk otomatis (Gemini Vision / Claude Vision)
Aesthetic  : Warframe Orokin (dark, gold, cyan)
```

---

## 🧩 Posisi dalam Ekosistem Clicker

```
Clicker Ecosystem
├── byod_pos        → Self-Order POS
├── membership      → Loyalty Program
├── inventory       → Stock Management
├── stocklens       → AI Inventory Scanner
├── reservation     → Booking & Scheduling
├── ai_sales        → AI Sales Chatbot
├── service_records → Vehicle Service
├── sales_pipeline  → CRM Kanban
└── fintrack        → Personal Finance Tracker ← THIS MODULE
```

---

## ✅ Fitur Utama

### Core
- Dashboard laporan bulanan & tahunan
- Pemasukan & pengeluaran
- Cashflow bersih + rata-rata harian
- Distribusi kategori (donut chart)
- Analisis keuangan (bar / line / pie chart)
- Riwayat transaksi dengan filter & search
- Multi wallet / dompet (fully custom, tidak hardcode)
- Transfer antar dompet

### AI Feature
- Scan struk / receipt → auto-fill form transaksi
- Deteksi: jumlah, tanggal, item detail, kategori

### Advanced
- Perencanaan (savings goals)
- Anggaran / budget per kategori
- Hutang & Piutang
- Transaksi Berulang (recurring)

---

## 👤 User Flow

### FLOW 1 — Onboarding

```
User buka app pertama kali
         ↓
Buat akun / login
         ↓
Setup dompet pertama
  ┌─────────────────────────────┐
  │ Nama Dompet : [___________] │
  │ Tipe        : [Bank ▾] atau │
  │               ketik sendiri │
  │ Icon        : 🏦 💳 📱 💵  │
  │ Warna       : 🟡 🔵 🔴 🟢  │
  │ Saldo Awal  : [___________] │
  └─────────────────────────────┘
         ↓
Masuk ke Dashboard
```

---

### FLOW 2 — Tambah Dompet Baru

```
Tap [ + TAMBAH DOMPET ]
         ↓
Form tambah dompet:
  - Nama bebas (contoh: BCA Utama, Jajan, Dana Darurat)
  - Tipe: Bank / E-Wallet / Cash / Investasi / + Custom (ketik sendiri)
  - Icon: pilih dari library
  - Warna badge: pilih warna
  - Saldo awal
         ↓
Simpan → muncul di Vault Dompet
```

> **Tidak ada nilai hardcode** — semua dari input user.
> Preset/suggestion hanya shortcut, tidak wajib.

---

### FLOW 3 — Input Transaksi

```
Tap [ + TRANSAKSI BARU ]
         ↓
Pilih mode:
┌──────────────┐     ┌────────────────────┐
│  ✎ MANUAL   │     │  ◈ SCAN STRUK AI   │
└──────┬───────┘     └─────────┬──────────┘
       │                       │
       ▼                       ▼
  Isi form manual         Foto / upload struk
  - Jumlah                      ↓
  - Kategori              AI analisa struk
  - Tanggal               (Gemini Vision)
  - Jenis (keluar/masuk)        ↓
  - Catatan               Auto-fill:
  - Bukti foto            - Jumlah total
  - Pilih dompet          - Tanggal
                          - Item → catatan
                          - Bukti foto tersimpan
                               ↓
                          User review & adjust
                          - Pilih dompet
                          - Konfirmasi kategori
                          - Jenis transaksi
       │                       │
       └──────────┬────────────┘
                  ↓
         [ SIMPAN TRANSAKSI ]
                  ↓
    Saldo dompet auto update
    Transaksi muncul di riwayat
    Dashboard refresh otomatis
```

---

### FLOW 4 — Transfer Antar Dompet

```
Tap [ ⇄ TRANSFER ]
         ↓
Pilih DARI dompet → KE dompet
Isi jumlah + tanggal + catatan (opsional)
         ↓
Konfirmasi
         ↓
BCA   : saldo berkurang
GoPay : saldo bertambah
Tercatat sebagai TRANSFER (bukan pengeluaran)
```

---

### FLOW 5 — Lihat Laporan

```
Dashboard
   ↓
Pilih dompet (semua / spesifik)
Pilih periode (bulanan / tahunan)
   ↓
Lihat:
- Total saldo
- Cashflow bersih
- Distribusi kategori
- Chart analisis
   ↓
Tap kategori → drill down transaksi
Tap transaksi → detail + bukti foto
```

---

## 🖥️ UI Wireframe (ASCII)

### Screen 1 — Dashboard

```
╔═══════════════════════════════════════════════════════════╗
║  ⚙ FINTRACK                  [ Bulanan ] [ Tahunan ]     ║
║  ·······················································  ║
║                                                          ║
║  ● BCA Utama ▾              < Januari 2026 >             ║
║                                                          ║
║  TOTAL SALDO                                             ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │         Rp 103.069.040                           │   ║
║  │         ▼ -0.5% bulan ini                        │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────┐    ┌──────────────────────────┐   ║
║  │  ↗ PEMASUKAN     │    │  ↘ PENGELUARAN           │   ║
║  │  Rp 20.500.000   │    │  Rp 560.000              │   ║
║  │  ▲ 66%           │    │  ▼ 21%                   │   ║
║  └──────────────────┘    └──────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ◈ ARUS KAS BERSIH (CASHFLOW)                    │   ║
║  │  + 59.9jt                        ~24rb/hari      │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  FITUR LANJUTAN                                  │   ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │   ║
║  │  │◉ RENCANA │ │⚙ ANGGRAN │ │⇄ HUTANG&PIUTANG  │  │   ║
║  │  │Liburan   │ │2 Kategori│ │Agus - Hutang Saya│  │   ║
║  │  └──────────┘ └──────────┘ └──────────────────┘  │   ║
║  │  ┌──────────┐                                   │   ║
║  │  │↻ BERULANG│                                   │   ║
║  │  │2 aktif   │                                   │   ║
║  │  └──────────┘                                   │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ◈ DISTRIBUSI PENGELUARAN       4 kategori       │   ║
║  │      ╭──────╮   ● Makanan    77%   580rb         │   ║
║  │     ╱  758rb ╲  ● Tagihan    15%   112rb         │   ║
║  │    │   total  │  ● Transport   7%    50rb         │   ║
║  │     ╲        ╱  ● Belanja     2%    16rb          │   ║
║  │      ╰──────╯                                    │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ◈ ANALISIS KEUANGAN    [bar] [line] [pie]        │   ║
║  │  50jt │                    ▓                     │   ║
║  │  25jt │              ░     ▓                     │   ║
║  │     0 ├──┬───┬──┬───┬──────┬───┬──              │   ║
║  │      12  14  16  18  20   25  27                 │   ║
║  │       ▓ Masuk    ░ Keluar                        │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║              [ ✦ + TRANSAKSI BARU ✦ ]                    ║
╚═══════════════════════════════════════════════════════════╝
```

---

### Screen 2 — Riwayat Transaksi

```
╔═══════════════════════════════════════════════════════════╗
║  ◈ RIWAYAT TRANSAKSI              < Februari 2026 >      ║
║  ·······················································  ║
║  🔍 Cari transaksi (judul, catatan)...                   ║
║                                                          ║
║  [ SEMUA ]  [ PENGELUARAN ]  [ PEMASUKAN ]               ║
║  [ SEMUA KATEGORI ] [ GAJI ] [ MAKANAN ] [ TAGIHAN ]     ║
║  [ TRANSPORT ] [ BELANJA ] [ LAINNYA ]                   ║
║                                                          ║
║  ── 27 FEB 2026 ─────────── ▼ 200rb  ▲ 20jt ──          ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  💰 Gaji           Gaji         +Rp 20.000.000  │    ║
║  │     🏦 BCA Utama                                │    ║
║  ├─────────────────────────────────────────────────┤    ║
║  │  🍴 Bukber         Makanan        -Rp 200.000   │    ║
║  │     📱 GoPay                                    │    ║
║  └─────────────────────────────────────────────────┘    ║
║                                                          ║
║  ── 26 FEB 2026 ──────────────────── ▼ 45rb ──           ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  🍴 Nasi bakar     Makanan         -Rp 20.000   │    ║
║  ├─────────────────────────────────────────────────┤    ║
║  │  🍴 Si goreng      Makanan         -Rp 20.000   │    ║
║  └─────────────────────────────────────────────────┘    ║
║                                 · · ·                    ║
╚═══════════════════════════════════════════════════════════╝
```

---

### Screen 3 — Input Transaksi

```
╔════════════════════════════════════════════════════════════╗
║  ◈ TRANSAKSI BARU                                         ║
║  ··················································        ║
║                                                           ║
║  ┌──────────────────┐   ┌───────────────────────────┐    ║
║  │    ✎  MANUAL     │   │   ◈  SCAN STRUK  AI       │    ║
║  └──────────────────┘   └───────────────────────────┘    ║
║                                                           ║
║  ══ MODE SCAN STRUK ══════════════════════════════════    ║
║                                                           ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  ╔══════════════════════╗                        │    ║
║  │  ║                      ║                        │    ║
║  │  ║  [ FOTO STRUK ZONE ] ║                        │    ║
║  │  ║                      ║                        │    ║
║  │  ╚══════════════════════╝                        │    ║
║  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ← scan beam             │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                           ║
║  ◈ SCANNING . . . ▓▓▓▓▓░░░░  50%                         ║
║                                                           ║
║  ══ CODEX RESULT — AUTO FILLED ══════════════════════     ║
║                                                           ║
║  JUMLAH                                                   ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  60.300                                    [✓]   │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                           ║
║  KATEGORI              TANGGAL                            ║
║  ┌──────────────┐  ┌────────────────────────────────┐    ║
║  │  Belanja     │  │  📅 4 Mar 2026                 │    ║
║  └──────────────┘  └────────────────────────────────┘    ║
║                                                           ║
║  JENIS                                                    ║
║  ┌──────────────────────┐  ┌─────────────────────┐       ║
║  │  ▓ PENGELUARAN ▓     │  │   Pemasukan         │       ║
║  └──────────────────────┘  └─────────────────────┘       ║
║                                                           ║
║  DOMPET                                                   ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  🏦 BCA Utama ▾                                  │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                           ║
║  CATATAN TAMBAHAN (dari struk)                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  CIK BMB AYM25, SASA AYH SPC2GG,                │    ║
║  │  KOBE CRSP 210G, GA TEP TPKA500G...             │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                           ║
║  BUKTI TRANSAKSI                                          ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │           [ foto struk tersimpan ]               │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                           ║
║   [ ✕ HAPUS ]          [ ✦ SIMPAN PERUBAHAN ✦ ]          ║
╚════════════════════════════════════════════════════════════╝
```

---

### Screen 4 — Vault Dompet

```
╔═══════════════════════════════════════════════════════════╗
║  ◈ VAULT DOMPET                                          ║
║  ·······················································  ║
║  Total Semua : Rp 103.069.040                            ║
║                                                          ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  🏦 BCA Utama              BANK          [►]    │    ║
║  │  Rp 82.719.040                                  │    ║
║  │  ▲ +20.5jt          ▼ -560rb                   │    ║
║  └─────────────────────────────────────────────────┘    ║
║                                                          ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  📱 GoPay                  E-WALLET      [►]    │    ║
║  │  Rp 250.000                                     │    ║
║  │  ▲ +500rb           ▼ -250rb                   │    ║
║  └─────────────────────────────────────────────────┘    ║
║                                                          ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  💵 Cash Harian            CASH          [►]    │    ║
║  │  Rp 100.000                                     │    ║
║  └─────────────────────────────────────────────────┘    ║
║                                                          ║
║  ── TRANSFER TERAKHIR ───────────────────────────        ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  🏦 BCA  ──── Rp 200.000 ────▶ 📱 GoPay        │    ║
║  │  27 Jan 2026                                    │    ║
║  └─────────────────────────────────────────────────┘    ║
║                                                          ║
║   [ ✦ + TAMBAH DOMPET ]        [ ⇄ TRANSFER ]           ║
╚═══════════════════════════════════════════════════════════╝
```

---

### Screen 5 — Fitur Lanjutan

```
╔═══════════════════════════════════════════════════════════╗
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ◉ PERENCANAAN                                   │   ║
║  │  Liburan ke Bali                                 │   ║
║  │  Target    : Rp 5.000.000                        │   ║
║  │  Terkumpul : Rp 2.300.000  ▓▓▓▓▓░░░░  46%       │   ║
║  │                      [ + TAMBAH RENCANA ]        │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ⚙ ANGGARAN                                      │   ║
║  │  Makanan  Budget: 1jt    Terpakai: 580rb  ▓▓▓░░  │   ║
║  │  Tagihan  Budget: 200rb  Terpakai: 112rb  ▓▓░░░  │   ║
║  │                         [ + TAMBAH ANGGARAN ]    │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ⇄ HUTANG & PIUTANG                              │   ║
║  │  Agus   HUTANG SAYA   Rp 500.000  [belum lunas]  │   ║
║  │  Budi   PIUTANG SAYA  Rp 200.000  [belum lunas]  │   ║
║  │                  [ + TAMBAH HUTANG/PIUTANG ]     │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  ↻ TRANSAKSI BERULANG                            │   ║
║  │  Netflix  Tagihan  Rp 54.000  setiap tgl 12      │   ║
║  │  Spotify  Tagihan  Rp 29.000  setiap tgl 1       │   ║
║  │                         [ + TAMBAH BERULANG ]    │   ║
║  └──────────────────────────────────────────────────┘   ║
╚═══════════════════════════════════════════════════════════╝
```

---

### Navigation Bar

```
╔═══════════════════════════════════════════════════════════╗
║  [ ◈ HOME ]  [ ⇄ TRANSAKSI ]  [ ✦ + ]  [ 🏦 DOMPET ]  [ ⚙ MORE ] ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🗄️ Database Schema

### wallets
```sql
CREATE TABLE wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  nama        VARCHAR(100) NOT NULL,      -- bebas input user
  tipe        VARCHAR(50),               -- bebas input / pilih
  icon        VARCHAR(10),               -- emoji icon
  warna       VARCHAR(7),               -- hex color #C8A951
  saldo_awal  BIGINT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);
-- Saldo current dihitung otomatis dari transaksi (tidak disimpan)
```

### transactions
```sql
CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  wallet_id     UUID REFERENCES wallets(id),
  jumlah        BIGINT NOT NULL,
  jenis         ENUM('pemasukan', 'pengeluaran', 'transfer'),
  kategori      VARCHAR(100),
  judul         VARCHAR(200),
  catatan       TEXT,
  bukti_url     VARCHAR(500),            -- foto struk
  tanggal       DATE NOT NULL,
  is_recurring  BOOLEAN DEFAULT FALSE,
  recurring_id  UUID REFERENCES recurring(id),
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### transfers
```sql
CREATE TABLE transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  from_wallet_id  UUID REFERENCES wallets(id),
  to_wallet_id    UUID REFERENCES wallets(id),
  jumlah          BIGINT NOT NULL,
  catatan         TEXT,
  tanggal         DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### categories
```sql
CREATE TABLE categories (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES users(id),   -- NULL = default kategori
  nama     VARCHAR(100) NOT NULL,
  icon     VARCHAR(10),
  warna    VARCHAR(7)
);
```

### budgets (Anggaran)
```sql
CREATE TABLE budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  category_id  UUID REFERENCES categories(id),
  jumlah       BIGINT NOT NULL,
  periode      ENUM('bulanan', 'tahunan'),
  bulan        INT,
  tahun        INT,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### goals (Perencanaan)
```sql
CREATE TABLE goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  nama          VARCHAR(200) NOT NULL,
  target        BIGINT NOT NULL,
  terkumpul     BIGINT DEFAULT 0,
  deadline      DATE,
  icon          VARCHAR(10),
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### debts (Hutang & Piutang)
```sql
CREATE TABLE debts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  nama        VARCHAR(100) NOT NULL,     -- nama orang
  jenis       ENUM('hutang', 'piutang'),
  jumlah      BIGINT NOT NULL,
  lunas       BOOLEAN DEFAULT FALSE,
  catatan     TEXT,
  deadline    DATE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### recurring (Transaksi Berulang)
```sql
CREATE TABLE recurring (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  wallet_id    UUID REFERENCES wallets(id),
  judul        VARCHAR(200) NOT NULL,
  jumlah       BIGINT NOT NULL,
  jenis        ENUM('pemasukan', 'pengeluaran'),
  kategori     VARCHAR(100),
  frekuensi    ENUM('harian', 'mingguan', 'bulanan', 'tahunan'),
  tgl_mulai    DATE NOT NULL,
  tgl_berikut  DATE NOT NULL,
  aktif        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 🤖 AI Scan Struk

### Prompt untuk Vision AI
```
Kamu adalah asisten scan struk belanja.
Analisa gambar struk/receipt berikut dan ekstrak:
1. total_bayar: jumlah total yang dibayar (angka saja, tanpa Rp/titik/koma)
2. tanggal: tanggal transaksi (format YYYY-MM-DD)
3. item_list: list nama item yang dibeli (array of string)
4. toko: nama toko/merchant jika ada

Kembalikan HANYA JSON valid, tidak ada teks lain:
{
  "total_bayar": 60300,
  "tanggal": "2026-03-04",
  "item_list": ["CIK BMB AYM25", "SASA AYH SPC2GG"],
  "toko": "Alfamart"
}
```

### Flow API
```
POST /api/fintrack/scan-struk
Content-Type: multipart/form-data
Body: { image: File }

Response:
{
  "jumlah": 60300,
  "tanggal": "2026-03-04",
  "catatan": "CIK BMB AYM25, SASA AYH SPC2GG, KOBE CRSP 210G...",
  "toko": "Alfamart",
  "bukti_url": "https://storage.../struk-xxx.jpg"
}
```

---

## 🔌 Tech Stack (Rekomendasi)

### Mobile
```
Framework  : React Native + Expo
Navigation : Expo Router
State      : Zustand
Charts     : Victory Native / Gifted Charts
Camera     : Expo Camera + Expo Image Picker
```

### Web
```
Framework  : Next.js (App Router)
UI         : Tailwind CSS
Charts     : Recharts / Chart.js
```

### Backend
```
API        : Next.js API Routes / Hono
Database   : Supabase (PostgreSQL)
Storage    : Supabase Storage (foto struk)
Auth       : Supabase Auth
AI Vision  : Google Gemini Vision / Claude Vision
```

### Shared
```
Language   : TypeScript
Validation : Zod
ORM        : Prisma / Drizzle
```

---

## 📡 API Endpoints

```
GET    /api/fintrack/dashboard          → summary dashboard
GET    /api/fintrack/transactions       → list transaksi (filter, search, pagination)
POST   /api/fintrack/transactions       → tambah transaksi
PUT    /api/fintrack/transactions/:id   → edit transaksi
DELETE /api/fintrack/transactions/:id   → hapus transaksi

GET    /api/fintrack/wallets            → list dompet user
POST   /api/fintrack/wallets            → tambah dompet baru
PUT    /api/fintrack/wallets/:id        → edit dompet
DELETE /api/fintrack/wallets/:id        → hapus dompet

POST   /api/fintrack/transfer           → transfer antar dompet

POST   /api/fintrack/scan-struk         → AI scan struk → auto-fill data

GET    /api/fintrack/budgets            → list anggaran
POST   /api/fintrack/budgets            → tambah anggaran

GET    /api/fintrack/goals              → list perencanaan
POST   /api/fintrack/goals              → tambah goal

GET    /api/fintrack/debts              → list hutang & piutang
POST   /api/fintrack/debts              → tambah hutang/piutang

GET    /api/fintrack/recurring          → list transaksi berulang
POST   /api/fintrack/recurring          → tambah recurring
```

---

## 🎨 Design System (Warframe Orokin)

```
Warna Utama:
  Background  : #0A0A0F
  Surface     : #111118
  Border      : #2A2A3A
  Gold        : #C8A951  ← primary accent
  Cyan        : #4FC3F7  ← secondary accent
  White       : #E8EDF5  ← text
  Gray        : #8892A4  ← subtext
  Red         : #E05C5C  ← pengeluaran / danger
  Green       : #50C878  ← pemasukan / success
  Yellow      : #F0C040  ← warning / second

Font:
  Display     : Courier New / monospace
  Body        : Inter / system-ui

Status Warna:
  Pemasukan   : #50C878 (green)
  Pengeluaran : #E05C5C (red)
  Transfer    : #4FC3F7 (cyan)
```

---

*fintrack — Modul Clicker Ecosystem*
*Catat. Pantau. Cuan.*
