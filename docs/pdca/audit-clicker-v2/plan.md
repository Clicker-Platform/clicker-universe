# Audit Rencana: clicker-platform-v2 (PDCA - Plan)

## 1. Latar Belakang & Tujuan
Audit komprehensif terhadap arsitektur *Next.js App Router*, *Server Components*, *State Management*, serta cakupan *Testing* di `clicker-platform-v2`. Tujuannya adalah mendokumentasikan kondisi per-kini, menemukan area potensial yang perlu dioptimalkan, dan merencanakan penambahan *test coverage* menggunakan praktik terbaik (terpengaruh oleh skill `nextjs-app-router-patterns` & `webapp-testing`).

## 2. Audit Arsitektur Next.js (App Router & Code Structure)
- **Middleware & Multi-tenant Routing:** Logika pembagian *subdomain* ke *path-based routing* telah terimplementasi dengan baik di `middleware.ts`. Data *tenant* dikirim dengan benar ke Server Components via headers (`x-site-id`, `x-clicker-is-subdomain`).
- **Server Components:** Komponen akar (`app/layout.tsx`) telah mengambil data setting server-side (`fetchSiteSettings`) dengan mitigasi `hydration warning`.
- **State Management:** Penggunaan React Context melalui `SiteProvider` sudah sesuai untuk menjaga konteks *tenant*. Ke depannya, disarankan audit re-render berlebih jika menggunakan state tersentralisasi.

## 3. Audit Testing (Vitest & Testing Library)
- **Cakupan Saat Ini (`__tests__`):** Terdapat sekitar 11 *test suite* yang tersebar di `components/blocks/public/`, `lib/modules/reservation/`, dan `lib/modules/service-records/`. Termasuk *tests* untuk UI state, inventory picker, dan approval state-machine.
- **Kendala Teridentifikasi:**
  1. `package.json` belum memiliki skrip `"test": "vitest"`.
  2. Terjadi error instalasi/cache lokal: `Error: Cannot find module 'vitest/config'` saat mengeksekusi vitest, yang mengindikasikan `node_modules` perlu di-*clean install* atau dependensi Vitest kurang lengkap.
- **Rencana Penambahan Tes Krusial:**
  1. Tes fungsional/E2E untuk **Middleware** (sangat penting untuk mencegah salah kirim data antar tenant).
  2. Tes unit untuk `SiteProvider` dan *fetch data fallback*.
  3. Konfigurasi `vitest.setup.ts` dan integrasinya dengan CI/pre-commit *hook* agar dipanggil dengan *script* standar `npm run test`.

## 4. Tindakan Selanjutnya (Do Phase)
1. Menambahkan skrip testing standar ke `package.json` (`"test": "vitest", "test:ui": "vitest --ui"`).
2. Memperbaiki *environment testing* (menjalankan `npm install` u/ memulihkan `node_modules` Vitest).
3. Mengembangkan struktur folder tes untuk lapisan **Core / Routing** (`__tests__/middleware.test.ts`).
4. Mengundang pengguna untuk mereviu spesifikasi tes krusial sebelum diimplementasi.

---
*Status: Menunggu Tinjauan (Pending Review)*
