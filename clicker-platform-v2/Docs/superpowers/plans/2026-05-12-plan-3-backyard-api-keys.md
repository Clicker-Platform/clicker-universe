# Backyard API Keys Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Backyard `/api-keys` screen for superadmin to manage platform secrets (GCP Secret Manager) and email config (Firestore), with health check per key.

**Architecture:** Backyard uses client-side Firebase SDK (no Firebase Admin). Secret Manager operations go through Next.js API routes in Backyard (`backyard/app/api/`) which call `lib/secrets/` server-side. Email config stored in Firestore `platform/email/config`, editable via Backyard UI.

**Tech Stack:** Next.js App Router, React, `lib/secrets/` (from Plan 1), Firestore client SDK, Tailwind CSS (Backyard pattern)

**Prerequisite:** Plan 1 (lib/secrets/) must be complete.

---

### Task 1: Add API Keys nav item to Sidebar

**Files:**
- Modify: `clicker-platform-v2/backyard/components/Sidebar.tsx` (path: `dev/backyard/components/Sidebar.tsx`)

- [ ] **Step 1: Add API Keys nav item**

In `backyard/components/Sidebar.tsx`, find `NAV_ITEMS` array:

```typescript
const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', href: '/' },
    { label: '—' as any, href: '' },
    { label: 'Tenants', href: '/tenants' },
    { label: 'Registrations', href: '/registrations' },
    { label: 'WhatsApp', href: '/whatsapp' },
    { label: '—' as any, href: '' },
    { label: 'Audit & Roles', href: '/access' },
    { label: '—' as any, href: '' },
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Sync Control', href: '/sync' },
    { label: 'Seed Tools', href: '/seed' },
    { label: '—' as any, href: '' },
    { label: 'Settings', href: '/settings' },
];
```

Add `API Keys` before `Settings`:

```typescript
const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', href: '/' },
    { label: '—' as any, href: '' },
    { label: 'Tenants', href: '/tenants' },
    { label: 'Registrations', href: '/registrations' },
    { label: 'WhatsApp', href: '/whatsapp' },
    { label: '—' as any, href: '' },
    { label: 'Audit & Roles', href: '/access' },
    { label: '—' as any, href: '' },
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Sync Control', href: '/sync' },
    { label: 'Seed Tools', href: '/seed' },
    { label: '—' as any, href: '' },
    { label: 'API Keys', href: '/api-keys' },
    { label: 'Settings', href: '/settings' },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd dev/backyard && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backyard/components/Sidebar.tsx
git commit -m "feat(backyard): add API Keys nav item to sidebar"
```

---

### Task 2: Build Backyard API routes — secrets

**Files:**
- Create: `dev/backyard/app/api/secrets/list/route.ts`
- Create: `dev/backyard/app/api/secrets/set/route.ts`
- Create: `dev/backyard/app/api/secrets/delete/route.ts`
- Create: `dev/backyard/app/api/secrets/test/route.ts`

- [ ] **Step 1: Create secrets/list/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { listSecrets } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const secrets = await listSecrets();
    return NextResponse.json({ secrets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create secrets/set/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { setSecret, SecretKey, SECRET_KEYS } from '@/lib/secrets';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json() as { key: string; value: string };

    if (!key || !value) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    }
    if (!(key in SECRET_KEYS)) {
      return NextResponse.json({ error: `Unknown secret key: ${key}` }, { status: 400 });
    }

    await setSecret(key as SecretKey, value);

    // Audit log
    const db = getFirestore();
    await db.collection('platform/auditLog/entries').add({
      action: 'secret.set',
      key,
      performedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create secrets/delete/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { deleteSecret, SecretKey, SECRET_KEYS } from '@/lib/secrets';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const { key } = await req.json() as { key: string };

    if (!key || !(key in SECRET_KEYS)) {
      return NextResponse.json({ error: `Unknown secret key: ${key}` }, { status: 400 });
    }

    await deleteSecret(key as SecretKey);

    const db = getFirestore();
    await db.collection('platform/auditLog/entries').add({
      action: 'secret.delete',
      key,
      performedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create secrets/test/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSecret, SecretKey, SECRET_KEYS } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

type TestResult = { ok: boolean; message: string };

async function testOpenRouter(key: string): Promise<TestResult> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected' };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

async function testResend(key: string): Promise<TestResult> {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected' };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

async function testUpstash(key: string): Promise<TestResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return { ok: false, message: 'UPSTASH_REDIS_REST_URL not set' };
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'Connected' };
  } catch (e: unknown) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

function testFormatOnly(key: string, minLength: number): TestResult {
  if (key.length < minLength) return { ok: false, message: `Too short (min ${minLength} chars)` };
  return { ok: true, message: 'Format valid' };
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json() as { key: string };

    if (!key || !(key in SECRET_KEYS)) {
      return NextResponse.json({ error: `Unknown secret key: ${key}` }, { status: 400 });
    }

    const value = await getSecret(key as SecretKey);

    let result: TestResult;
    switch (key as SecretKey) {
      case 'OPENROUTER_API_KEY':
        result = await testOpenRouter(value); break;
      case 'RESEND_API_KEY':
        result = await testResend(value); break;
      case 'UPSTASH_REDIS_REST_TOKEN':
        result = await testUpstash(value); break;
      case 'WA_WEBHOOK_VERIFY_TOKEN':
        result = testFormatOnly(value, 8); break;
      case 'META_APP_SECRET':
        result = testFormatOnly(value, 16); break;
      case 'WA_ENCRYPTION_KEY':
        result = testFormatOnly(value, 32); break;
      default:
        result = { ok: true, message: 'Exists' };
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add backyard/app/api/secrets/
git commit -m "feat(backyard): add secrets API routes (list, set, delete, test)"
```

---

### Task 3: Build Backyard API routes — email config

**Files:**
- Create: `dev/backyard/app/api/email-config/get/route.ts`
- Create: `dev/backyard/app/api/email-config/update/route.ts`

- [ ] **Step 1: Create email-config/get/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const DEFAULTS = {
  templates: {
    passwordReset: 'password-reset',
    emailVerification: 'email-verification',
    formSubmission: 'form-submission',
    systemAlert: 'system-alert',
    regConfirmation: 'registration-confirmation',
    regAdminNotif: 'registration-admin-notif',
  },
  sender: {
    domain: 'clicker.id',
    localPart: 'noreply',
    fromName: 'Clicker Platform',
  },
};

export async function GET() {
  try {
    const db = getFirestore();
    const doc = await db.doc('platform/email/config').get();
    if (doc.exists) {
      const data = doc.data()!;
      return NextResponse.json({
        templates: { ...DEFAULTS.templates, ...data.templates },
        sender: { ...DEFAULTS.sender, ...data.sender },
      });
    }
    return NextResponse.json(DEFAULTS);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create email-config/update/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      templates?: Record<string, string>;
      sender?: Record<string, string>;
      updatedBy?: string;
    };

    const db = getFirestore();
    await db.doc('platform/email/config').set(
      {
        ...(body.templates && { templates: body.templates }),
        ...(body.sender && { sender: body.sender }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: body.updatedBy ?? 'unknown',
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backyard/app/api/email-config/
git commit -m "feat(backyard): add email-config API routes (get, update)"
```

---

### Task 4: Build SecretCard component

**Files:**
- Create: `dev/backyard/app/api-keys/_components/SecretCard.tsx`

- [ ] **Step 1: Create SecretCard.tsx**

```tsx
'use client';

import { useState } from 'react';
import { Key, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface SecretCardProps {
  secretKey: string;
  label: string;
  description: string;
  exists: boolean;
  onRefresh: () => void;
}

const KEY_LABELS: Record<string, { label: string; description: string }> = {
  OPENROUTER_API_KEY:      { label: 'OpenRouter API Key',       description: 'AI model gateway (all AI features)' },
  RESEND_API_KEY:          { label: 'Resend API Key',           description: 'Email delivery service' },
  WA_WEBHOOK_VERIFY_TOKEN: { label: 'WhatsApp Verify Token',    description: 'Meta webhook verification token' },
  META_APP_SECRET:         { label: 'Meta App Secret',          description: 'WhatsApp webhook signature validation' },
  WA_ENCRYPTION_KEY:       { label: 'WhatsApp Encryption Key',  description: 'Token encryption for WA connections' },
  UPSTASH_REDIS_REST_TOKEN:{ label: 'Upstash Redis Token',      description: 'Cache layer for performance' },
};

export function SecretCard({ secretKey, exists, onRefresh }: SecretCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const meta = KEY_LABELS[secretKey] ?? { label: secretKey, description: '' };

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/secrets/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/secrets/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey, value: newValue.trim() }),
      });
      setNewValue('');
      setShowInput(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${meta.label}? This will break dependent features.`)) return;
    setDeleting(true);
    try {
      await fetch('/api/secrets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey }),
      });
      onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-gray-400" />
          <span className="font-bold text-brand-dark text-sm">{meta.label}</span>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${exists ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {exists ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {exists ? 'Set' : 'Missing'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3 ml-6">{meta.description}</p>

      {testResult && (
        <div className={`text-xs px-3 py-2 rounded-lg mb-3 font-medium ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok ? '✅' : '❌'} {testResult.message}
        </div>
      )}

      {showInput && (
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <input
              type={showValue ? 'text' : 'password'}
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="Paste new value..."
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono pr-10"
            />
            <button
              onClick={() => setShowValue(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !newValue.trim()}
            className="bg-brand-dark text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          <button onClick={() => { setShowInput(false); setNewValue(''); }} className="px-3 py-2 text-sm text-gray-500">
            Cancel
          </button>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {exists && (
          <>
            <button
              onClick={handleTest}
              disabled={testing}
              className="text-xs font-semibold px-3 py-1.5 border-2 border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 flex items-center gap-1"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Test
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold px-3 py-1.5 border-2 border-red-200 text-red-600 rounded-lg hover:border-red-400 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
        <button
          onClick={() => { setShowInput(v => !v); setTestResult(null); }}
          className="text-xs font-semibold px-3 py-1.5 bg-brand-dark text-white rounded-lg hover:opacity-90"
        >
          {exists ? 'Update' : 'Set Key'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add backyard/app/api-keys/_components/SecretCard.tsx
git commit -m "feat(backyard): add SecretCard component"
```

---

### Task 5: Build EmailConfigPanel component

**Files:**
- Create: `dev/backyard/app/api-keys/_components/EmailConfigPanel.tsx`

- [ ] **Step 1: Create EmailConfigPanel.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

interface EmailConfig {
  templates: {
    passwordReset: string;
    emailVerification: string;
    formSubmission: string;
    systemAlert: string;
    regConfirmation: string;
    regAdminNotif: string;
  };
  sender: {
    domain: string;
    localPart: string;
    fromName: string;
  };
}

const TEMPLATE_LABELS: Record<keyof EmailConfig['templates'], string> = {
  passwordReset:    'Password Reset',
  emailVerification:'Email Verification',
  formSubmission:   'Form Submission',
  systemAlert:      'System Alert',
  regConfirmation:  'Registration Confirmation',
  regAdminNotif:    'Registration Admin Notif',
};

export function EmailConfigPanel() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/email-config/get')
      .then(r => r.json())
      .then((data: EmailConfig) => setConfig(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    await fetch('/api/email-config/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, updatedBy: 'superadmin' }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="text-sm text-gray-400">Loading email config...</div>;
  if (!config) return null;

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-gray-400" />
        <span className="font-black text-brand-dark">Email Configuration</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {(['domain', 'localPart', 'fromName'] as const).map(field => (
          <div key={field}>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
              {field === 'domain' ? 'Sender Domain' : field === 'localPart' ? 'Local Part' : 'From Name'}
            </label>
            <input
              type="text"
              value={config.sender[field]}
              onChange={e => setConfig(c => c ? { ...c, sender: { ...c.sender, [field]: e.target.value } } : c)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="border-t-2 border-gray-100 pt-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Template IDs (Resend)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(TEMPLATE_LABELS) as (keyof EmailConfig['templates'])[]).map(field => (
            <div key={field}>
              <label className="text-xs text-gray-500 mb-1 block">{TEMPLATE_LABELS[field]}</label>
              <input
                type="text"
                value={config.templates[field]}
                onChange={e => setConfig(c => c ? { ...c, templates: { ...c.templates, [field]: e.target.value } } : c)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end items-center gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-dark text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add backyard/app/api-keys/_components/EmailConfigPanel.tsx
git commit -m "feat(backyard): add EmailConfigPanel component"
```

---

### Task 6: Build main API Keys page

**Files:**
- Create: `dev/backyard/app/api-keys/page.tsx`

- [ ] **Step 1: Create page.tsx**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { KeyRound, RefreshCw } from 'lucide-react';
import { SecretCard } from './_components/SecretCard';
import { EmailConfigPanel } from './_components/EmailConfigPanel';

interface SecretStatus {
  key: string;
  exists: boolean;
}

const KEY_META: Record<string, { label: string; description: string }> = {
  OPENROUTER_API_KEY:      { label: 'OpenRouter API Key',       description: 'AI model gateway (all AI features)' },
  RESEND_API_KEY:          { label: 'Resend API Key',           description: 'Email delivery service' },
  WA_WEBHOOK_VERIFY_TOKEN: { label: 'WhatsApp Verify Token',    description: 'Meta webhook verification token' },
  META_APP_SECRET:         { label: 'Meta App Secret',          description: 'WhatsApp webhook signature validation' },
  WA_ENCRYPTION_KEY:       { label: 'WhatsApp Encryption Key',  description: 'Token encryption for WA connections' },
  UPSTASH_REDIS_REST_TOKEN:{ label: 'Upstash Redis Token',      description: 'Cache layer for performance' },
};

export default function ApiKeysPage() {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/secrets/list');
      const data = await res.json() as { secrets: SecretStatus[] };
      setSecrets(data.secrets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSecrets(); }, [fetchSecrets]);

  const missingCount = secrets.filter(s => !s.exists).length;

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
              <KeyRound className="w-8 h-8" />
              API KEYS
            </h1>
            <p className="text-gray-500 font-medium">Platform secrets & email configuration</p>
          </div>
          <button
            onClick={fetchSecrets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border-[3px] border-gray-200 rounded-xl text-sm font-bold hover:border-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {missingCount > 0 && (
          <div className="bg-amber-50 border-[3px] border-amber-200 rounded-2xl p-4 mb-6">
            <p className="text-amber-800 font-bold text-sm">
              ⚠️ {missingCount} secret{missingCount > 1 ? 's' : ''} missing — related features will not work until configured.
            </p>
          </div>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-black text-brand-dark mb-4">Platform Secrets</h2>
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {secrets.map(secret => (
                <SecretCard
                  key={secret.key}
                  secretKey={secret.key}
                  label={KEY_META[secret.key]?.label ?? secret.key}
                  description={KEY_META[secret.key]?.description ?? ''}
                  exists={secret.exists}
                  onRefresh={fetchSecrets}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-black text-brand-dark mb-4">Email Configuration</h2>
          <EmailConfigPanel />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd dev/backyard && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backyard/app/api-keys/
git commit -m "feat(backyard): add API Keys screen with secret management + email config"
```

---

### Task 7: Verify end-to-end

- [ ] **Step 1: Start Backyard dev server**

```bash
cd dev/backyard && pnpm dev
```

- [ ] **Step 2: Navigate to /api-keys**

Open `http://localhost:3011/api-keys` (or Backyard port).

Expected:
- All 6 secret cards visible
- Each shows Set/Missing status
- Test button works for OpenRouter, Resend, Redis
- Update flow: click Update → input → Save → status refreshes
- Email config loads with current Firestore values (or defaults)
- Email config Save writes to Firestore

- [ ] **Step 3: Test update flow**

Click Update on any key → paste a test value → Save.
Expected: card status updates to "Set".

- [ ] **Step 4: Test email config save**

Change a template ID → Save Changes.
Expected: "Saved" confirmation, Firestore `platform/email/config` updated.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(backyard): complete API Keys screen — secrets + email config"
```
