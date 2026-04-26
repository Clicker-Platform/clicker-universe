# Stocklens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Stocklens — an AI-powered inventory scanner module that lets users photograph a product and have Gemini Vision + Google Search Grounding auto-identify it, generate a SKU, and save it to a per-tenant vault.

**Architecture:** New module `stocklens` registered in 3-way parity (definitions + seed). Firestore hierarchy: `sites/{siteId}/modules/stocklens/skus/{skuId}/units/{unitId}`. Three Next.js API routes handle scan, duplicate-check, and settings. Client SDK for reads, firebase-admin for API key access. Pattern mirrors `ai-sales-agent` for Gemini client and key storage.

**Tech Stack:** Next.js 14 App Router, Firebase Firestore + Storage, `@google/generative-ai` (already installed via ai-sales-agent), Sonner toasts, Lucide icons, Tailwind, `useSite()` context.

---

## File Map

### New files (created in this plan)

```
lib/modules/stocklens/
  constants.ts
  types.ts
  api.ts
  server/
    gemini-scanner.ts
  admin/
    ScannerPage.tsx
    ScanUploader.tsx
    ScanResultCard.tsx
    ConditionSelector.tsx
    DuplicatePrompt.tsx
    VaultPage.tsx
    VaultSKUCard.tsx
    DetailPage.tsx
    SettingsPage.tsx

app/admin/stocklens/
  page.tsx
  vault/
    page.tsx
    [skuId]/
      page.tsx
  settings/
    page.tsx

app/api/stocklens/
  scan/route.ts
  check-sku/route.ts
  settings/route.ts
```

### Modified files

```
clicker-platform-v2/lib/modules/definitions.ts          ← add stocklens entry
clicker-platform-v2/lib/modules/components.tsx          ← add dynamic imports
clicker-platform-v2/scripts/seed-modules.ts             ← add stocklens seed
clicker-platform-v2/backyard/lib/modules/definitions.ts ← add stocklens entry (3-way parity)
```

---

## Task 1: Module constants & types

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/constants.ts`
- Create: `clicker-platform-v2/lib/modules/stocklens/types.ts`

- [ ] **Step 1: Create constants.ts**

```ts
// clicker-platform-v2/lib/modules/stocklens/constants.ts
export const STOCKLENS_SKUS = 'modules/stocklens/skus';
export const STOCKLENS_UNITS = 'units';
export const STOCKLENS_CONFIG = 'modules/stocklens/private/config';
export const STOCKLENS_STORAGE = 'stocklens/units';

export const CONDITION_LABELS = {
  BNIB: 'Brand New In Box',
  BNOB: 'Brand New Open Box',
  SECOND: 'Bekas Normal',
  BROKEN: 'Rusak',
} as const;

export const CONDITION_COLORS = {
  BNIB: 'text-yellow-400 border-yellow-400',
  BNOB: 'text-cyan-400 border-cyan-400',
  SECOND: 'text-yellow-300 border-yellow-300',
  BROKEN: 'text-red-400 border-red-400',
} as const;

export const CATEGORY_CODES = [
  'ELC', 'TOY', 'SHO', 'CLO', 'GAM', 'SPT', 'HOM', 'BOO', 'ACC', 'GEN',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  ELC: 'Electronics',
  TOY: 'Toys / Collectible',
  SHO: 'Shoes',
  CLO: 'Clothing / Fashion',
  GAM: 'Gaming',
  SPT: 'Sports',
  HOM: 'Home / Living',
  BOO: 'Books',
  ACC: 'Accessories',
  GEN: 'General / Mixed',
};
```

- [ ] **Step 2: Create types.ts**

```ts
// clicker-platform-v2/lib/modules/stocklens/types.ts
import { Timestamp } from 'firebase/firestore';
import { CATEGORY_CODES } from './constants';

export type ItemCondition = 'BNIB' | 'BNOB' | 'SECOND' | 'BROKEN';
export type CategoryCode = typeof CATEGORY_CODES[number];

export interface VaultSKU {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: CategoryCode;
  series?: string;
  releasePrice: number;
  aiAnalysis: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VaultUnit {
  id: string;
  skuId: string;
  condition: ItemCondition;
  marketPrice: number;
  photoUrl: string;
  year?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface ScanResult {
  name: string;
  brand: string;
  category: CategoryCode;
  sku: string;
  series?: string;
  releasePrice: number;
  marketPrice: number;
  suggestedCondition: ItemCondition;
  aiAnalysis: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/constants.ts clicker-platform-v2/lib/modules/stocklens/types.ts
git commit -m "feat(stocklens): add module constants and types"
```

---

## Task 2: Firestore API (client SDK)

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/api.ts`

- [ ] **Step 1: Create api.ts**

```ts
// clicker-platform-v2/lib/modules/stocklens/api.ts
import {
  collection, doc, getDocs, addDoc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VaultSKU, VaultUnit, ItemCondition } from './types';
import { STOCKLENS_SKUS, STOCKLENS_UNITS } from './constants';

export async function getVaultSKUs(siteId: string): Promise<VaultSKU[]> {
  const q = query(
    collection(db, 'sites', siteId, STOCKLENS_SKUS),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultSKU));
}

export async function getVaultSKU(siteId: string, skuId: string): Promise<VaultSKU | null> {
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'sites', siteId, STOCKLENS_SKUS, skuId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as VaultSKU;
}

export async function createVaultSKU(
  siteId: string,
  data: Omit<VaultSKU, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, STOCKLENS_SKUS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteVaultSKU(siteId: string, skuId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, STOCKLENS_SKUS, skuId));
}

export async function getVaultUnits(siteId: string, skuId: string): Promise<VaultUnit[]> {
  const q = query(
    collection(db, 'sites', siteId, STOCKLENS_SKUS, skuId, STOCKLENS_UNITS),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultUnit));
}

export async function createVaultUnit(
  siteId: string,
  skuId: string,
  data: Omit<VaultUnit, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'sites', siteId, STOCKLENS_SKUS, skuId, STOCKLENS_UNITS),
    { ...data, createdAt: serverTimestamp() }
  );
  return ref.id;
}

export async function deleteVaultUnit(siteId: string, skuId: string, unitId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, STOCKLENS_SKUS, skuId, STOCKLENS_UNITS, unitId));
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/api.ts
git commit -m "feat(stocklens): add Firestore client API"
```

---

## Task 3: Gemini scanner server utility

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/server/gemini-scanner.ts`

> Note: `@google/generative-ai` is already installed (used by ai-sales-agent). `adminDb` is from `@/lib/firebase-admin`.

- [ ] **Step 1: Create gemini-scanner.ts**

```ts
// clicker-platform-v2/lib/modules/stocklens/server/gemini-scanner.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { ScanResult, ItemCondition, CategoryCode } from '../types';
import { STOCKLENS_CONFIG, CATEGORY_CODES } from '../constants';

async function getApiKey(siteId: string): Promise<string | null> {
  try {
    const snap = await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).get();
    if (snap.exists) return snap.data()?.apiKey || null;
    return process.env.GEMINI_API_KEY || null;
  } catch (e) {
    logger.error('stocklens.apikey.fetch.failed', { siteId, error: e });
    return null;
  }
}

const SCAN_PROMPT = `You are a product identification expert. Analyze this product image and use Google Search to find accurate product details.

Return ONLY a JSON object with these exact fields:
{
  "name": "Full product name including series/variant",
  "brand": "Brand or manufacturer name",
  "category": "One of: ELC, TOY, SHO, CLO, GAM, SPT, HOM, BOO, ACC, GEN",
  "sku": "Suggested SKU in format CAT-BRAND3-MODEL (e.g. TOY-HSB-BHEAD)",
  "series": "Product series if applicable, otherwise omit",
  "releasePrice": 0,
  "marketPrice": 0,
  "suggestedCondition": "One of: BNIB, BNOB, SECOND, BROKEN based on visual",
  "aiAnalysis": "Short product description in Bahasa Indonesia, 1-2 sentences"
}

Rules:
- releasePrice and marketPrice must be numbers in IDR (Indonesian Rupiah), no symbols
- category must be exactly one of the listed codes
- suggestedCondition: BNIB if sealed/new looking, BNOB if box opened, SECOND if used, BROKEN if damaged
- sku brand code: use first 3 letters of brand (Apple→APL, Nike→NKE, Hasbro→HSB, Sony→SNY)
- If you cannot identify the product, use best guess with low confidence values`;

export async function scanProductImage(
  siteId: string,
  imageBase64: string,
  mimeType: string
): Promise<ScanResult> {
  const apiKey = await getApiKey(siteId);
  if (!apiKey) throw new Error('Gemini API Key belum dikonfigurasi. Silakan atur di Settings.');

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} } as any],
  });

  const result = await model.generateContent([
    SCAN_PROMPT,
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const text = result.response.text();

  // Strip markdown code fences if present
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    logger.error('stocklens.scan.parse.failed', { siteId, raw: text });
    // Return empty scaffold so UI can fall back to manual entry
    return {
      name: '',
      brand: '',
      category: 'GEN',
      sku: '',
      releasePrice: 0,
      marketPrice: 0,
      suggestedCondition: 'SECOND',
      aiAnalysis: 'Produk tidak dapat diidentifikasi. Silakan isi manual.',
    };
  }

  // Validate category
  const category: CategoryCode = CATEGORY_CODES.includes(parsed.category)
    ? parsed.category
    : 'GEN';

  const conditions: ItemCondition[] = ['BNIB', 'BNOB', 'SECOND', 'BROKEN'];
  const suggestedCondition: ItemCondition = conditions.includes(parsed.suggestedCondition)
    ? parsed.suggestedCondition
    : 'SECOND';

  return {
    name: parsed.name || '',
    brand: parsed.brand || '',
    category,
    sku: parsed.sku || '',
    series: parsed.series,
    releasePrice: Number(parsed.releasePrice) || 0,
    marketPrice: Number(parsed.marketPrice) || 0,
    suggestedCondition,
    aiAnalysis: parsed.aiAnalysis || '',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/server/gemini-scanner.ts
git commit -m "feat(stocklens): add Gemini Vision + Search Grounding scanner"
```

---

## Task 4: API routes

**Files:**
- Create: `clicker-platform-v2/app/api/stocklens/scan/route.ts`
- Create: `clicker-platform-v2/app/api/stocklens/check-sku/route.ts`
- Create: `clicker-platform-v2/app/api/stocklens/settings/route.ts`

- [ ] **Step 1: Create scan/route.ts**

```ts
// clicker-platform-v2/app/api/stocklens/scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { scanProductImage } from '@/lib/modules/stocklens/server/gemini-scanner';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const siteId = formData.get('siteId') as string;
    const file = formData.get('image') as File;

    if (!siteId || !file) {
      return NextResponse.json({ error: 'siteId and image are required' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const result = await scanProductImage(siteId, base64, mimeType);
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('stocklens.scan.route.failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create check-sku/route.ts**

```ts
// clicker-platform-v2/app/api/stocklens/check-sku/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { STOCKLENS_SKUS } from '@/lib/modules/stocklens/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { siteId, sku } = await req.json();
    if (!siteId || !sku) {
      return NextResponse.json({ error: 'siteId and sku required' }, { status: 400 });
    }

    const snap = await adminDb
      .collection(`sites/${siteId}/${STOCKLENS_SKUS}`)
      .where('sku', '==', sku)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ exists: false });
    }

    const doc = snap.docs[0];
    return NextResponse.json({ exists: true, skuId: doc.id, existingData: { id: doc.id, ...doc.data() } });
  } catch (error: any) {
    logger.error('stocklens.check-sku.failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create settings/route.ts**

```ts
// clicker-platform-v2/app/api/stocklens/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { STOCKLENS_CONFIG } from '@/lib/modules/stocklens/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  try {
    const snap = await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).get();
    return NextResponse.json({ hasKey: snap.exists && !!snap.data()?.apiKey });
  } catch (error: any) {
    logger.error('stocklens.settings.get.failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { siteId, apiKey } = await req.json();
    if (!siteId || !apiKey) {
      return NextResponse.json({ error: 'siteId and apiKey required' }, { status: 400 });
    }

    await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).set(
      { apiKey, updatedAt: Date.now() },
      { merge: true }
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('stocklens.settings.post.failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/app/api/stocklens/
git commit -m "feat(stocklens): add scan, check-sku, and settings API routes"
```

---

## Task 5: Settings UI page

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/SettingsPage.tsx`
- Create: `clicker-platform-v2/app/admin/stocklens/settings/page.tsx`

- [ ] **Step 1: Create SettingsPage.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/SettingsPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Key, Save, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';

export default function StocklensSettingsPage() {
  const { siteId } = useSite();
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/stocklens/settings?siteId=${siteId}`)
      .then(r => r.json())
      .then(d => setHasKey(d.hasKey))
      .catch(e => logger.error('stocklens.settings.load.failed', { siteId, error: e }));
  }, [siteId]);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stocklens/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, apiKey: apiKey.trim() }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      setHasKey(true);
      setApiKey('');
      toast.success('API Key berhasil disimpan');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      // Send a minimal scan request with a 1x1 blank image to test key validity
      const formData = new FormData();
      formData.append('siteId', siteId);
      // Create a minimal JPEG blob
      const arr = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      formData.append('image', new Blob([arr], { type: 'image/jpeg' }), 'test.jpg');
      const res = await fetch('/api/stocklens/scan', { method: 'POST', body: formData });
      if (res.status === 500) {
        const data = await res.json();
        if (data.error?.includes('API Key')) throw new Error(data.error);
      }
      toast.success('Koneksi Gemini berhasil');
    } catch (e: any) {
      toast.error('Test gagal: ' + e.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Key className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Gemini API Key</h2>
        {hasKey && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
            <CheckCircle className="w-3.5 h-3.5" /> Terkonfigurasi
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Masukkan Gemini API Key dari Google AI Studio. Key disimpan secara aman di server.
      </p>
      <input
        type="password"
        placeholder={hasKey ? '••••••••••••••••' : 'AIza...'}
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan
        </button>
        {hasKey && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Test Koneksi
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/admin/stocklens/settings/page.tsx**

```tsx
// clicker-platform-v2/app/admin/stocklens/settings/page.tsx
import StocklensSettingsPage from '@/lib/modules/stocklens/admin/SettingsPage';
export default StocklensSettingsPage;
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/admin/SettingsPage.tsx clicker-platform-v2/app/admin/stocklens/settings/page.tsx
git commit -m "feat(stocklens): add settings page for Gemini API key config"
```

---

## Task 6: Scanner UI — uploader & result card

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/ScanUploader.tsx`
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/ScanResultCard.tsx`
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/ConditionSelector.tsx`
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/DuplicatePrompt.tsx`

- [ ] **Step 1: Create ScanUploader.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/ScanUploader.tsx
'use client';

import { useRef, useState } from 'react';
import { Upload, Camera, Loader2, ScanLine } from 'lucide-react';
import Image from 'next/image';

interface Props {
  onImageReady: (file: File, previewUrl: string) => void;
  scanning: boolean;
}

export function ScanUploader({ onImageReady, scanning }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function resizeAndEmit(file: File) {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return;
        const resized = new File([blob], file.name, { type: 'image/jpeg' });
        const resizedUrl = URL.createObjectURL(resized);
        setPreview(resizedUrl);
        onImageReady(resized, resizedUrl);
      }, 'image/jpeg', 0.85);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) resizeAndEmit(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) resizeAndEmit(file);
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 transition hover:border-primary"
        onClick={() => !scanning && inputRef.current?.click()}
      >
        {preview ? (
          <Image src={preview} alt="preview" fill className="rounded-xl object-contain p-2" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ScanLine className="w-10 h-10" />
            <p className="text-sm font-medium">Upload atau drag foto produk</p>
            <p className="text-xs">JPG, PNG, WEBP</p>
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/80 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Menganalisa produk...</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <div className="flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={scanning}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted"
        >
          <Upload className="w-4 h-4" /> Upload Foto
        </button>
        <button
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.capture = 'environment';
              inputRef.current.click();
            }
          }}
          disabled={scanning}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted"
        >
          <Camera className="w-4 h-4" /> Ambil Foto
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ScanResultCard.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/ScanResultCard.tsx
'use client';

import { ScanResult } from '../types';
import { CATEGORY_LABELS, CONDITION_LABELS } from '../constants';
import { Lock, Pencil } from 'lucide-react';

interface Props {
  result: ScanResult;
  marketPrice: number;
  onMarketPriceChange: (v: number) => void;
}

export function ScanResultCard({ result, marketPrice, onMarketPriceChange }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Codex Result</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <Field label="Nama" value={result.name || '—'} span />
        <Field label="Brand" value={result.brand || '—'} />
        <Field label="Kategori" value={CATEGORY_LABELS[result.category] || result.category} />
        <Field label="SKU" value={result.sku || '—'} mono />
        {result.series && <Field label="Seri" value={result.series} />}
      </div>
      <div className="border-t pt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Harga Rilis
          </p>
          <p className="font-medium">Rp {result.releasePrice.toLocaleString('id-ID')}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Harga Pasar
          </p>
          <input
            type="number"
            value={marketPrice}
            onChange={e => onMarketPriceChange(Number(e.target.value))}
            className="w-full rounded border bg-background px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      {result.aiAnalysis && (
        <p className="text-xs text-muted-foreground border-t pt-2">{result.aiAnalysis}</p>
      )}
    </div>
  );
}

function Field({ label, value, span, mono }: { label: string; value: string; span?: boolean; mono?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create ConditionSelector.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/ConditionSelector.tsx
'use client';

import { ItemCondition } from '../types';
import { CONDITION_LABELS, CONDITION_COLORS } from '../constants';

interface Props {
  value: ItemCondition;
  onChange: (v: ItemCondition) => void;
}

const CONDITIONS: ItemCondition[] = ['BNIB', 'BNOB', 'SECOND', 'BROKEN'];

export function ConditionSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Pilih Kondisi</p>
      <div className="grid grid-cols-4 gap-2">
        {CONDITIONS.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition
              ${value === c
                ? `${CONDITION_COLORS[c]} bg-muted`
                : 'border-border text-muted-foreground hover:bg-muted'
              }`}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{CONDITION_LABELS[value]}</p>
    </div>
  );
}
```

- [ ] **Step 4: Create DuplicatePrompt.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/DuplicatePrompt.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sku: string;
  onDifferentiate: (year: string) => void;
  onMerge: () => void;
}

export function DuplicatePrompt({ sku, onDifferentiate, onMerge }: Props) {
  const [year, setYear] = useState('');
  const [showYear, setShowYear] = useState(false);

  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium"><code className="text-xs bg-muted px-1 rounded">{sku}</code> sudah ada di Vault.</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bedakan versi tahun, atau tambahkan unit ke SKU yang sama?</p>
        </div>
      </div>
      {showYear ? (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Tahun (e.g. 2023)"
            value={year}
            onChange={e => setYear(e.target.value)}
            maxLength={4}
            className="flex-1 rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => year && onDifferentiate(year)}
            disabled={!year}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Konfirmasi
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setShowYear(true)}
            className="flex-1 rounded-lg border border-yellow-400/50 px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Ya, Bedakan
          </button>
          <button
            onClick={onMerge}
            className="flex-1 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Sama Aja
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/admin/ScanUploader.tsx clicker-platform-v2/lib/modules/stocklens/admin/ScanResultCard.tsx clicker-platform-v2/lib/modules/stocklens/admin/ConditionSelector.tsx clicker-platform-v2/lib/modules/stocklens/admin/DuplicatePrompt.tsx
git commit -m "feat(stocklens): add scanner UI components"
```

---

## Task 7: ScannerPage — main scanner screen

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/ScannerPage.tsx`
- Create: `clicker-platform-v2/app/admin/stocklens/page.tsx`

- [ ] **Step 1: Create ScannerPage.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/ScannerPage.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { logger } from '@/lib/logger';
import { ScanResult, ItemCondition, VaultSKU } from '../types';
import { createVaultSKU, createVaultUnit } from '../api';
import { STOCKLENS_STORAGE } from '../constants';
import { ScanUploader } from './ScanUploader';
import { ScanResultCard } from './ScanResultCard';
import { ConditionSelector } from './ConditionSelector';
import { DuplicatePrompt } from './DuplicatePrompt';
import { Vault, Save, RotateCcw } from 'lucide-react';
import Link from 'next/link';

type Phase = 'upload' | 'result' | 'saved';

export default function ScannerPage() {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();

  const [phase, setPhase] = useState<Phase>('upload');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [marketPrice, setMarketPrice] = useState(0);
  const [condition, setCondition] = useState<ItemCondition>('SECOND');

  const [duplicate, setDuplicate] = useState<{ skuId: string; existingData: VaultSKU } | null>(null);
  const [resolvedSkuId, setResolvedSkuId] = useState<string | null>(null);
  const [yearSuffix, setYearSuffix] = useState<string | null>(null);

  async function handleImageReady(file: File) {
    setImageFile(file);
    setScanning(true);
    setScanResult(null);
    setDuplicate(null);
    setResolvedSkuId(null);
    setYearSuffix(null);

    try {
      const formData = new FormData();
      formData.append('siteId', siteId);
      formData.append('image', file);
      const res = await fetch('/api/stocklens/scan', { method: 'POST', body: formData });
      const data: ScanResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Scan gagal');

      setScanResult(data);
      setMarketPrice(data.marketPrice);
      setCondition(data.suggestedCondition);
      setPhase('result');

      // Check duplicate
      const checkRes = await fetch('/api/stocklens/check-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, sku: data.sku }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setDuplicate({ skuId: checkData.skuId, existingData: checkData.existingData });
      }
    } catch (e: any) {
      logger.error('stocklens.scanner.scan.failed', { siteId, error: e });
      toast.error(e.message || 'Scan gagal. Coba lagi.');
      setPhase('upload');
    } finally {
      setScanning(false);
    }
  }

  function handleDifferentiate(year: string) {
    setYearSuffix(year);
    setDuplicate(null);
  }

  function handleMerge() {
    if (duplicate) setResolvedSkuId(duplicate.skuId);
    setDuplicate(null);
  }

  async function handleSave() {
    if (!scanResult || !imageFile || marketPrice === 0) {
      toast.error('Harga pasar tidak boleh 0');
      return;
    }
    if (isViewOnly) return;

    setSaving(true);
    try {
      // 1. Upload photo
      const storage = getStorage();
      const unitDocId = crypto.randomUUID();
      const storageRef = ref(storage, `sites/${siteId}/${STOCKLENS_STORAGE}/${unitDocId}/${imageFile.name}`);
      await uploadBytes(storageRef, imageFile);
      const photoUrl = await getDownloadURL(storageRef);

      // 2. Resolve SKU
      let skuId = resolvedSkuId;
      if (!skuId) {
        const finalSku = yearSuffix ? `${scanResult.sku}-${yearSuffix}` : scanResult.sku;
        skuId = await createVaultSKU(siteId, {
          sku: finalSku,
          name: scanResult.name,
          brand: scanResult.brand,
          category: scanResult.category,
          series: scanResult.series,
          releasePrice: scanResult.releasePrice,
          aiAnalysis: scanResult.aiAnalysis,
        });
      }

      // 3. Create unit
      await createVaultUnit(siteId, skuId, {
        skuId,
        condition,
        marketPrice,
        photoUrl,
        year: yearSuffix || undefined,
      });

      setPhase('saved');
      toast.success('Berhasil disimpan ke Vault');
    } catch (e: any) {
      logger.error('stocklens.scanner.save.failed', { siteId, error: e });
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPhase('upload');
    setScanResult(null);
    setImageFile(null);
    setDuplicate(null);
    setResolvedSkuId(null);
    setYearSuffix(null);
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Stocklens Scanner</h1>
        <Link href="/admin/stocklens/vault" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Vault className="w-4 h-4" /> Vault
        </Link>
      </div>

      {phase === 'upload' && (
        <ScanUploader onImageReady={handleImageReady} scanning={scanning} />
      )}

      {phase === 'result' && scanResult && (
        <div className="space-y-4">
          <ScanResultCard
            result={scanResult}
            marketPrice={marketPrice}
            onMarketPriceChange={setMarketPrice}
          />
          {duplicate && !resolvedSkuId && (
            <DuplicatePrompt
              sku={scanResult.sku}
              onDifferentiate={handleDifferentiate}
              onMerge={handleMerge}
            />
          )}
          <ConditionSelector value={condition} onChange={setCondition} />
          <button
            onClick={handleSave}
            disabled={saving || !!duplicate}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan ke Vault</>}
          </button>
        </div>
      )}

      {phase === 'saved' && (
        <div className="space-y-4 text-center py-8">
          <p className="text-lg font-semibold">Tersimpan ke Vault!</p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleReset} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
              <RotateCcw className="w-4 h-4" /> Scan Lagi
            </button>
            <Link href="/admin/stocklens/vault" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Vault className="w-4 h-4" /> Lihat Vault
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create app/admin/stocklens/page.tsx**

```tsx
// clicker-platform-v2/app/admin/stocklens/page.tsx
import ScannerPage from '@/lib/modules/stocklens/admin/ScannerPage';
export default ScannerPage;
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/admin/ScannerPage.tsx clicker-platform-v2/app/admin/stocklens/page.tsx
git commit -m "feat(stocklens): add main scanner page"
```

---

## Task 8: Vault Inventory list

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/VaultSKUCard.tsx`
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/VaultPage.tsx`
- Create: `clicker-platform-v2/app/admin/stocklens/vault/page.tsx`

- [ ] **Step 1: Create VaultSKUCard.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/VaultSKUCard.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { VaultSKU, VaultUnit } from '../types';
import { getVaultUnits } from '../api';
import { CONDITION_LABELS, CONDITION_COLORS, CATEGORY_LABELS } from '../constants';
import { useSite } from '@/lib/site-context';

interface Props { sku: VaultSKU }

export function VaultSKUCard({ sku }: Props) {
  const { siteId } = useSite();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<VaultUnit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || units.length > 0) return;
    setLoading(true);
    getVaultUnits(siteId, sku.id)
      .then(setUnits)
      .finally(() => setLoading(false));
  }, [open, siteId, sku.id, units.length]);

  // Group units by condition
  const byCondition = units.reduce((acc, u) => {
    acc[u.condition] = [...(acc[u.condition] || []), u];
    return acc;
  }, {} as Record<string, VaultUnit[]>);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
      >
        <div>
          <p className="font-medium text-sm">{sku.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{sku.sku} · {CATEGORY_LABELS[sku.category] || sku.category}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {loading && <p className="text-xs text-muted-foreground px-4 py-3">Memuat...</p>}
          {Object.entries(byCondition).map(([cond, cunits]) => (
            <div key={cond} className="flex gap-3 px-4 py-3">
              <div className="flex gap-1">
                {cunits.slice(0, 3).map(u => (
                  <div key={u.id} className="relative w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0">
                    {u.photoUrl && <Image src={u.photoUrl} alt={cond} fill className="object-cover" />}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`inline-block text-xs font-bold border rounded px-1.5 py-0.5 ${CONDITION_COLORS[cond as keyof typeof CONDITION_COLORS]}`}>
                  {cond}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">×{cunits.length} unit</p>
                <p className="text-sm font-medium">Rp {cunits[0].marketPrice.toLocaleString('id-ID')}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-2">
            <Link
              href={`/admin/stocklens/vault/${sku.id}`}
              className="text-xs text-primary hover:underline"
            >
              Lihat Detail →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create VaultPage.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/VaultPage.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';
import { VaultSKU } from '../types';
import { getVaultSKUs } from '../api';
import { VaultSKUCard } from './VaultSKUCard';
import { CATEGORY_LABELS } from '../constants';

export default function VaultPage() {
  const { siteId } = useSite();
  const [skus, setSkus] = useState<VaultSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    if (!siteId) return;
    getVaultSKUs(siteId)
      .then(setSkus)
      .catch(e => logger.error('stocklens.vault.load.failed', { siteId, error: e }))
      .finally(() => setLoading(false));
  }, [siteId]);

  const categories = useMemo(() => {
    const seen = new Set(skus.map(s => s.category));
    return Array.from(seen);
  }, [skus]);

  const filtered = useMemo(() => skus.filter(s => {
    const matchCat = categoryFilter === 'ALL' || s.category === categoryFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [skus, categoryFilter, search]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Vault Inventory</h1>
        <Link href="/admin/stocklens" className="flex items-center gap-1.5 text-sm rounded-lg bg-primary px-3 py-2 text-primary-foreground font-medium">
          <ScanLine className="w-4 h-4" /> Scan
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari nama atau SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['ALL', ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition
              ${categoryFilter === cat ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {cat === 'ALL' ? 'Semua' : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Memuat vault...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Vault kosong.</p>
          <Link href="/admin/stocklens" className="text-xs text-primary hover:underline mt-1 inline-block">Scan produk pertama →</Link>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map(sku => <VaultSKUCard key={sku.id} sku={sku} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create app/admin/stocklens/vault/page.tsx**

```tsx
// clicker-platform-v2/app/admin/stocklens/vault/page.tsx
import VaultPage from '@/lib/modules/stocklens/admin/VaultPage';
export default VaultPage;
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/admin/VaultSKUCard.tsx clicker-platform-v2/lib/modules/stocklens/admin/VaultPage.tsx clicker-platform-v2/app/admin/stocklens/vault/page.tsx
git commit -m "feat(stocklens): add vault inventory list"
```

---

## Task 9: Detail SKU page

**Files:**
- Create: `clicker-platform-v2/lib/modules/stocklens/admin/DetailPage.tsx`
- Create: `clicker-platform-v2/app/admin/stocklens/vault/[skuId]/page.tsx`

- [ ] **Step 1: Create DetailPage.tsx**

```tsx
// clicker-platform-v2/lib/modules/stocklens/admin/DetailPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Lock, ScanLine, Trash2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { logger } from '@/lib/logger';
import { VaultSKU, VaultUnit } from '../types';
import { getVaultSKU, getVaultUnits, deleteVaultSKU, deleteVaultUnit } from '../api';
import { CONDITION_LABELS, CONDITION_COLORS, CATEGORY_LABELS } from '../constants';

export default function DetailPage() {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();
  const params = useParams<{ skuId: string }>();
  const router = useRouter();

  const [sku, setSku] = useState<VaultSKU | null>(null);
  const [units, setUnits] = useState<VaultUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!siteId || !params.skuId) return;
    Promise.all([getVaultSKU(siteId, params.skuId), getVaultUnits(siteId, params.skuId)])
      .then(([s, u]) => { setSku(s); setUnits(u); })
      .catch(e => logger.error('stocklens.detail.load.failed', { siteId, error: e }))
      .finally(() => setLoading(false));
  }, [siteId, params.skuId]);

  async function handleDeleteSKU() {
    if (!sku || isViewOnly) return;
    try {
      await deleteVaultSKU(siteId, sku.id);
      toast.success('SKU dihapus');
      router.push('/admin/stocklens/vault');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDeleteUnit(unitId: string) {
    if (!sku || isViewOnly) return;
    try {
      await deleteVaultUnit(siteId, sku.id, unitId);
      setUnits(u => u.filter(x => x.id !== unitId));
      toast.success('Unit dihapus');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Group by condition for stock summary
  const byCondition = units.reduce((acc, u) => {
    acc[u.condition] = [...(acc[u.condition] || []), u];
    return acc;
  }, {} as Record<string, VaultUnit[]>);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Memuat...</div>;
  if (!sku) return <div className="p-6 text-sm text-muted-foreground">SKU tidak ditemukan.</div>;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/stocklens/vault" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{sku.name}</p>
          <p className="text-xs font-mono text-muted-foreground">{sku.sku} · {CATEGORY_LABELS[sku.category] || sku.category}</p>
        </div>
      </div>

      {/* Photo swiper */}
      {units.length > 0 && (
        <div className="space-y-2">
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted">
            <Image src={units[activePhoto]?.photoUrl || ''} alt={sku.name} fill className="object-contain" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {units.map((u, i) => (
              <button
                key={u.id}
                onClick={() => setActivePhoto(i)}
                className={`shrink-0 relative w-12 h-12 rounded-md overflow-hidden border-2 transition
                  ${activePhoto === i ? 'border-primary' : 'border-transparent'}`}
              >
                <Image src={u.photoUrl} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI analysis */}
      {sku.aiAnalysis && (
        <p className="text-sm text-muted-foreground">{sku.aiAnalysis}</p>
      )}

      {/* Harga rilis */}
      <div className="flex items-center gap-2 text-sm">
        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Harga Rilis:</span>
        <span className="font-medium">Rp {sku.releasePrice.toLocaleString('id-ID')}</span>
      </div>

      {/* Stock per condition */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Stok per Kondisi</p>
        {Object.entries(byCondition).map(([cond, cunits]) => (
          <div key={cond} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className={`text-xs font-bold border rounded px-1.5 py-0.5 ${CONDITION_COLORS[cond as keyof typeof CONDITION_COLORS]}`}>
              {cond}
            </span>
            <span className="text-sm">×{cunits.length}</span>
            <span className="text-sm font-medium">Rp {cunits[0].marketPrice.toLocaleString('id-ID')}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-right">Total ×{units.length} unit</p>
      </div>

      {/* Units list with delete */}
      {!isViewOnly && units.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Semua Unit</p>
          {units.map(u => (
            <div key={u.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="relative w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
                <Image src={u.photoUrl} alt="" fill className="object-cover" />
              </div>
              <span className={`text-xs font-bold border rounded px-1 ${CONDITION_COLORS[u.condition]}`}>{u.condition}</span>
              <span className="text-sm flex-1">Rp {u.marketPrice.toLocaleString('id-ID')}</span>
              <button onClick={() => handleDeleteUnit(u.id)} className="text-muted-foreground hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Link
          href={`/admin/stocklens?sku=${sku.sku}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <ScanLine className="w-4 h-4" /> Scan Tambah Unit
        </Link>
        {!isViewOnly && (
          <button
            onClick={handleDeleteSKU}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/30 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-400/10"
          >
            <Trash2 className="w-4 h-4" /> Hapus SKU
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/admin/stocklens/vault/[skuId]/page.tsx**

```tsx
// clicker-platform-v2/app/admin/stocklens/vault/[skuId]/page.tsx
import DetailPage from '@/lib/modules/stocklens/admin/DetailPage';
export default DetailPage;
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/stocklens/admin/DetailPage.tsx clicker-platform-v2/app/admin/stocklens/vault/[skuId]/page.tsx
git commit -m "feat(stocklens): add SKU detail page with unit swiper and delete"
```

---

## Task 10: Module registration (3-way parity)

**Files:**
- Modify: `clicker-platform-v2/lib/modules/definitions.ts`
- Modify: `clicker-platform-v2/lib/modules/components.tsx`
- Modify: `clicker-platform-v2/scripts/seed-modules.ts`
- Modify: `clicker-platform-v2/backyard/lib/modules/definitions.ts` (if exists)

- [ ] **Step 1: Add to lib/modules/definitions.ts**

Open `clicker-platform-v2/lib/modules/definitions.ts`. Add after the `'inventory'` entry:

```ts
'stocklens': {
    adminRoutes: [
        { label: 'Scanner',   path: '/admin/stocklens',          icon: 'scan-line',  componentKey: 'stocklens:ScannerPage' },
        { label: 'Vault',     path: '/admin/stocklens/vault',     icon: 'vault',      componentKey: 'stocklens:VaultPage' },
        { label: 'Settings',  path: '/admin/stocklens/settings',  icon: 'settings',   componentKey: 'stocklens:SettingsPage', permission: 'settings' },
    ]
},
```

- [ ] **Step 2: Add to lib/modules/components.tsx**

Add dynamic imports near the inventory section:

```ts
// Admin Pages (Stocklens)
const SL_ScannerPage  = dynamic(() => import('@/lib/modules/stocklens/admin/ScannerPage'));
const SL_VaultPage    = dynamic(() => import('@/lib/modules/stocklens/admin/VaultPage'));
const SL_SettingsPage = dynamic(() => import('@/lib/modules/stocklens/admin/SettingsPage'));
```

Add to the `MODULE_COMPONENTS` export object:

```ts
// Stocklens Module
'stocklens:ScannerPage':  SL_ScannerPage,
'stocklens:VaultPage':    SL_VaultPage,
'stocklens:SettingsPage': SL_SettingsPage,
```

- [ ] **Step 3: Add to scripts/seed-modules.ts**

Add after the `inventory` entry in the `MODULES` array:

```ts
{
    id: 'stocklens',
    displayName: 'Stocklens',
    description: 'AI-powered product scanner and inventory vault',
    icon: 'scan-line',
    version: '1.0.0',
    enabled: true,
    adminRoutes: [
        { label: 'Scanner',  path: '/admin/stocklens',         icon: 'scan-line', componentKey: 'stocklens:ScannerPage' },
        { label: 'Vault',    path: '/admin/stocklens/vault',    icon: 'vault',     componentKey: 'stocklens:VaultPage' },
        { label: 'Settings', path: '/admin/stocklens/settings', icon: 'settings',  componentKey: 'stocklens:SettingsPage', permission: 'settings' },
    ],
},
```

- [ ] **Step 4: Add to backyard/lib/modules/definitions.ts**

Open `backyard/lib/modules/definitions.ts` (in the monorepo root `backyard/` directory, not inside `clicker-platform-v2/`). Add the same `stocklens` entry as in Step 1.

- [ ] **Step 5: Verify parity**

Run a quick check that all three files now contain `stocklens`:

```bash
grep -r "stocklens" clicker-platform-v2/lib/modules/definitions.ts clicker-platform-v2/scripts/seed-modules.ts
```

Expected: 3+ matches across the files.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/modules/definitions.ts clicker-platform-v2/lib/modules/components.tsx clicker-platform-v2/scripts/seed-modules.ts
git commit -m "feat(stocklens): register module in 3-way parity (definitions + components + seed)"
```

---

## Task 11: Build check & smoke test

- [ ] **Step 1: Run TypeScript check**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```

Expected: No errors. Fix any type mismatches before continuing.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No errors.

- [ ] **Step 3: Start dev server and verify routes**

```bash
pnpm dev
```

Open these URLs and confirm they render without errors:
- `http://localhost:3000/admin/stocklens` — Scanner page loads
- `http://localhost:3000/admin/stocklens/vault` — Vault list loads (empty state)
- `http://localhost:3000/admin/stocklens/settings` — Settings page with API key input

- [ ] **Step 4: Configure Gemini API key**

In the Settings page, enter a valid Gemini API key and save. Confirm toast "API Key berhasil disimpan" appears.

- [ ] **Step 5: Run a test scan**

Upload a product photo in the Scanner page. Confirm:
- Loading state "Menganalisa produk..." appears
- CODEX RESULT card populates with name, brand, SKU, prices
- Condition selector appears
- "Simpan ke Vault" button is active after duplicate prompt resolves

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(stocklens): complete module implementation — scanner, vault, detail, settings"
```
