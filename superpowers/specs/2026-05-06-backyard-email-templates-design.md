# Backyard Email Templates — Design Spec

**Date:** 2026-05-06
**Status:** Approved
**Scope:** Tab baru di Backyard untuk edit global default copy email (subject + body) per template type, disimpan di Firestore dengan fallback ke hardcoded default.

---

## 1. Goals & Non-Goals

### Goals

- Superadmin dapat mengedit teks (subject + body) untuk 4 system email templates via Backyard UI.
- Perubahan disimpan ke Firestore `system/emailTemplates` dan langsung efektif tanpa deploy.
- Kalau field kosong / dokumen belum ada → fallback otomatis ke teks hardcoded di kode.
- Superadmin dapat kirim test email menggunakan teks yang sedang diedit (belum disave pun bisa).
- Warning tampil jika variable wajib tidak ada di body, tapi tidak memblok save.

### Non-Goals

- Per-tenant template override (future).
- History / versioning.
- Validasi hard-block.
- Custom HTML atau layout email.
- Localization (i18n).

---

## 2. Decisions Summary

| # | Decision | Choice |
|---|----------|--------|
| 1 | Storage | Firestore `system/emailTemplates`, single doc |
| 2 | Fallback | `null` field → hardcoded default di kode |
| 3 | UI layout | Tab per template type |
| 4 | Variable injection | Button tetap dirender kode; body hanya teks paragraf |
| 5 | Validasi | Warning saja, tidak block save |
| 6 | Send test | Default ke email superadmin login, bisa override ke custom email |
| 7 | Cache | 5 menit in-process, sama dengan `getEmailContext` |

---

## 3. Navigasi

Tambah item `Email Templates` di Backyard Sidebar (`components/Sidebar.tsx`), diletakkan antara `Seed Tools` dan separator sebelum `Settings`:

```
- Tenants
- WhatsApp
—
- Audit & Roles
—
- Monitoring
- Sync Control
- Seed Tools
- Email Templates   ← baru
—
- Settings
```

Route: `/email-templates`

---

## 4. UI Layout

```
┌─────────────────────────────────────────────────────┐
│  ✉  EMAIL TEMPLATES                                 │
│  Global default copy. Fallback: hardcoded default.  │
├─────────────────────────────────────────────────────┤
│  [Password Reset] [Email Verify] [Form Sub] [Alert] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Subject                                            │
│  ┌───────────────────────────────────────────────┐  │
│  │ Reset your password                           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Body                                               │
│  ┌───────────────────────────────────────────────┐  │
│  │ We received a request to reset your password. │  │
│  │ Click the button below to choose a new one.   │  │
│  │ If you didn't request this, ignore this email.│  │
│  └───────────────────────────────────────────────┘  │
│  ⚠ {{resetLink}} missing — link position not set   │
│  Variables: {{businessName}} {{resetLink}}          │
│                                                     │
│  [Save]        [Send Test ▾]                        │
│                 → Send to me (admin@clicker.id)     │
│                 → Send to: [___________] [Send]     │
│                                                     │
│  ✓ Saved  (flash 2 detik setelah save berhasil)     │
└─────────────────────────────────────────────────────┘
```

### Tab contents per template

| Tab | Subject editable | Body editable | Variables tersedia |
|-----|-----------------|---------------|-------------------|
| Password Reset | ✓ | ✓ | `{{businessName}}` `{{resetLink}}` |
| Email Verification | ✓ | ✓ | `{{businessName}}` `{{verifyLink}}` |
| Form Submission | ✓ | ✗ (body dinamis dari field form) | `{{formTitle}}` |
| System Alert | ✓ | ✓ | `{{businessName}}` |

### Warning logic

- `PasswordReset` body: warn jika `{{resetLink}}` tidak ada
- `EmailVerification` body: warn jika `{{verifyLink}}` tidak ada
- Warning hanya informatif, tidak memblok save

### Send Test behavior

- **Send to me**: kirim ke email superadmin yang sedang login (dari Firebase Auth `currentUser.email`)
- **Send to custom**: dropdown expand → input email manual → tombol Send
- Kirim menggunakan teks yang **sedang di-editor saat ini** (state lokal, bukan yang tersimpan di Firestore)
- Menggunakan `sendEmail()` dengan `siteId: null` (system email, branding Clicker Platform)

---

## 5. Firestore Schema

**Path:** `system/emailTemplates` (single document)

```ts
type EmailTemplatesDoc = {
  passwordReset: {
    subject: string;
    body: string;
  } | null;

  emailVerification: {
    subject: string;
    body: string;
  } | null;

  formSubmission: {
    subject: string;
    // body tidak disimpan — dinamis dari form fields
  } | null;

  systemAlert: {
    subject: string;
    body: string;
  } | null;
};
```

- Field `null` atau dokumen tidak ada → fallback ke hardcoded default
- Tidak ada `updatedAt` / `updatedBy` (no versioning per keputusan)
- Dokumen dibuat pertama kali saat superadmin klik Save

---

## 6. Integrasi ke `lib/email/`

### 6.1 `getEmailTemplates()` — baru di `lib/email/templates-config.ts`

```ts
export type EmailTemplatesDoc = { ... }; // seperti schema di atas

export async function getEmailTemplates(): Promise<EmailTemplatesDoc>;
```

- Baca `system/emailTemplates` dari Firestore
- Cache in-process 5 menit (sama dengan `getEmailContext`)
- Fallback ke semua `null` jika doc tidak ada atau error
- Export `_resetEmailTemplatesCache()` untuk testing

### 6.2 Merge di masing-masing template component

Setiap system template menerima prop opsional `overrides?: { subject?: string; body?: string }`. Caller (`sendEmail` orchestration) mengisi ini dari `getEmailTemplates()`.

Contoh di `PasswordReset.tsx`:

```ts
// Hardcoded defaults tetap ada di kode
const DEFAULT_BODY = "We received a request to reset...";

// Override dari Firestore dipakai jika ada
const body = overrides?.body ?? DEFAULT_BODY;
```

Button (`{{resetLink}}`) tetap dirender oleh komponen — tidak bisa dihilangkan lewat body teks.

### 6.3 Update `sender.ts`

Sebelum render template, fetch `getEmailTemplates()` dan pass ke template sebagai `overrides`.

---

## 7. Backyard API Route

Backyard adalah all-client app yang hanya boleh pakai Cloud Functions. Untuk save dan send test, gunakan Cloud Functions:

| Function | Trigger | Action |
|----------|---------|--------|
| `saveEmailTemplates` | HTTPS callable | Write `system/emailTemplates` doc |
| `sendTestEmail` | HTTPS callable | Call `sendEmail()` dengan teks dari request |

Kedua function hanya bisa dipanggil oleh superadmin (verify custom claim `superadmin: true`).

---

## 8. File Structure

### Baru — `clicker-platform-v2/lib/email/`

| File | Fungsi |
|------|--------|
| `templates-config.ts` | `getEmailTemplates()` + cache |

### Baru — `functions/src/`

| File | Fungsi |
|------|--------|
| `saveEmailTemplates.ts` | HTTPS callable — write Firestore |
| `sendTestEmail.ts` | HTTPS callable — kirim test email |

### Baru — `backyard/app/email-templates/`

| File | Fungsi |
|------|--------|
| `page.tsx` | Halaman utama + tab state |
| `TemplateEditor.tsx` | Form editor per tab (subject, body, warning, save, send test) |

### Dimodifikasi

| File | Perubahan |
|------|-----------|
| `backyard/components/Sidebar.tsx` | Tambah nav item `Email Templates` |
| `clicker-platform-v2/lib/email/sender.ts` | Fetch `getEmailTemplates()` sebelum render |
| `clicker-platform-v2/lib/email/templates/system/*.tsx` | Terima `overrides` prop |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Superadmin hapus `{{resetLink}}` dari body | Warning kuning ditampilkan; button tetap dirender kode |
| Cache stale — edit tidak langsung efektif | 5 menit TTL; acceptable untuk superadmin use case |
| `sendTestEmail` function dipanggil non-superadmin | Verify `superadmin` custom claim di function handler |
| Doc `system/emailTemplates` tidak ada saat pertama deploy | `getEmailTemplates()` fallback ke semua `null` — tidak ada breaking change |
