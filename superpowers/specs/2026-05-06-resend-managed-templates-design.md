# Resend-Managed Email Templates — Design Spec

**Date:** 2026-05-06
**Status:** Approved
**Scope:** Migrasi dari React Email (render di kode) ke Resend-managed templates (render di Resend dashboard). Konten template diedit di resend.com tanpa sentuh kode atau deploy.

---

## 1. Goals & Non-Goals

### Goals

- Template email (subject, body, styling) dikelola sepenuhnya di Resend dashboard.
- Edit konten template efektif langsung tanpa deploy.
- Kode hanya kirim `templateAlias` + `variables` ke Resend API.
- Hapus React Email dependencies dari codebase.
- Semua fitur foundation tetap berfungsi: audit log, dev allowlist, tenant context.

### Non-Goals

- Per-tenant template override.
- Backyard UI untuk edit template (tidak diperlukan — pakai resend.com langsung).
- Preview test email dari Backyard.
- Validasi variable di template.

---

## 2. Decisions Summary

| # | Decision | Choice |
|---|----------|--------|
| 1 | Template storage | Resend dashboard — diidentifikasi via `templateAlias` |
| 2 | Template ID config | Env var per template type |
| 3 | React Email | Dihapus sepenuhnya |
| 4 | `sendEmail()` API | Ganti `template: ReactElement` → `templateAlias + variables` |
| 5 | Tenant branding | `businessName` dipass sebagai variable ke Resend |

---

## 3. Perubahan Public API

### `SendEmailInput` — sebelum & sesudah

```ts
// SEBELUM
type SendEmailInput = {
  to: string | string[];
  subject: string;
  template: ReactElement;        // ← React Email component
  siteId: string | null;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: EmailTag[];
};

// SESUDAH
type SendEmailInput = {
  to: string | string[];
  templateAlias: string;          // ← Resend template alias
  variables: Record<string, string>; // ← variable untuk template
  siteId: string | null;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: EmailTag[];
};
```

`subject` dihapus dari input — subject sudah ada di dalam Resend template.

### Contoh pemanggilan

```ts
// Password reset
await sendEmail({
  to: email,
  siteId,
  templateAlias: 'password-reset',
  variables: {
    businessName: context.fromName,
    resetLink,
  },
});

// Form submission
await sendEmail({
  to: emailTo,
  siteId,
  templateAlias: 'form-submission',
  variables: {
    businessName: context.fromName,
    formTitle,
    formData: JSON.stringify(data), // atau formatted string
  },
  tags: [{ name: 'module', value: 'core_crm' }],
});
```

---

## 4. Resend API Call

```ts
// sender.ts — setelah refactor
await resend.emails.send({
  from: fromHeader,
  to: toList,
  replyTo,
  templateAlias: input.templateAlias,     // ← ganti html/text
  variables: {
    ...input.variables,
    businessName: context.fromName,       // selalu inject dari tenant context
  },
});
```

Tidak ada render step — tidak ada `renderTemplate()` call.

---

## 5. Resend Dashboard Setup

4 templates dibuat manual di resend.com. Superadmin login ke resend.com dan buat template dengan alias berikut:

| Template Alias | Variables tersedia |
|----------------|--------------------|
| `password-reset` | `{{businessName}}` `{{resetLink}}` |
| `email-verification` | `{{businessName}}` `{{verifyLink}}` |
| `form-submission` | `{{businessName}}` `{{formTitle}}` `{{formData}}` |
| `system-alert` | `{{businessName}}` `{{title}}` `{{body}}` |

Template alias di Resend harus persis sama dengan nilai di env var.

---

## 6. Env Vars

Ditambahkan ke `.env.local` (platform) dan `.env` (auth-gateway):

```bash
# Template aliases — harus match dengan alias di Resend dashboard
RESEND_TEMPLATE_PASSWORD_RESET=password-reset
RESEND_TEMPLATE_EMAIL_VERIFY=email-verification
RESEND_TEMPLATE_FORM_SUBMISSION=form-submission
RESEND_TEMPLATE_SYSTEM_ALERT=system-alert
```

Dibaca dari `lib/email/config.ts`:

```ts
export function getTemplateAliases() {
  return {
    passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET ?? 'password-reset',
    emailVerification: process.env.RESEND_TEMPLATE_EMAIL_VERIFY ?? 'email-verification',
    formSubmission: process.env.RESEND_TEMPLATE_FORM_SUBMISSION ?? 'form-submission',
    systemAlert: process.env.RESEND_TEMPLATE_SYSTEM_ALERT ?? 'system-alert',
  };
}
```

---

## 7. File Changes

### Dihapus

| File/Folder | Alasan |
|-------------|--------|
| `lib/email/templates/` | Semua React Email components tidak dipakai |
| `lib/email/render.ts` | Tidak ada render step |
| `lib/email/email-context-provider.tsx` | Tidak diperlukan tanpa React Email |

### Dimodifikasi

| File | Perubahan |
|------|-----------|
| `lib/email/types.ts` | Ganti `template: ReactElement` → `templateAlias + variables` |
| `lib/email/sender.ts` | Hapus render step, kirim `templateAlias + variables` ke Resend |
| `lib/email/config.ts` | Tambah `getTemplateAliases()` |
| `lib/email/index.ts` | Hapus export templates (FormSubmission, PasswordReset, dll) |
| `app/api/forms/submit/route.ts` | Update `sendEmail()` call — pakai `templateAlias` |
| `auth-gateway/app/api/password-reset/route.ts` | Update `sendEmail()` call |
| `auth-gateway/app/api/email-verification/route.ts` | Update `sendEmail()` call |
| `clicker-platform-v2/package.json` | Uninstall `@react-email/components`, `@react-email/render`, `react-email` |
| `auth-gateway/package.json` | Uninstall `@react-email/components`, `@react-email/render` |

### Sync

Setelah perubahan `lib/email/`, jalankan `./scripts/sync-email-module.sh` untuk sync ke auth-gateway.

---

## 8. Testing

| Layer | Strategy |
|-------|----------|
| `sender.ts` | Update mock — assert `templateAlias` + `variables` dikirim ke Resend, bukan `html` |
| `config.ts` | Tambah test untuk `getTemplateAliases()` env resolution |
| End-to-end | Kirim test email manual dari dev ke Resend sandbox setelah templates dibuat di dashboard |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Template alias di env tidak match dengan Resend dashboard | Resend return error → dicatat di audit log dengan `status: failed` |
| Variable `{{resetLink}}` tidak ada di template Resend | Email terkirim tapi tanpa link — tanggung jawab superadmin saat setup template di resend.com |
| Resend template belum dibuat saat pertama deploy | `sendEmail()` return `ok: false`, log error — tidak crash app |
| Auth-gateway copy drift | Jalankan `./scripts/sync-email-module.sh` setelah selesai |
