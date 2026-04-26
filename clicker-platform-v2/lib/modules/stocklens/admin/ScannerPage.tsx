'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { logger } from '@/lib/logger-edge';
import { ScanResult, ItemCondition, VaultSKU } from '../types';
import { createVaultSKU, createVaultUnit, getVaultSKUs } from '../api';
import { STOCKLENS_STORAGE } from '../constants';
import { ScanUploader } from './ScanUploader';
import { ScanResultCard } from './ScanResultCard';
import { ConditionSelector } from './ConditionSelector';
import { DuplicatePrompt } from './DuplicatePrompt';
import { Vault, Save, RotateCcw, ScanLine, Sparkles, Settings as SettingsIcon, AlertCircle, CheckCircle2, Box, Zap } from 'lucide-react';
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

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [vaultCount, setVaultCount] = useState<number>(0);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/stocklens/settings?siteId=${siteId}`)
      .then(r => r.json())
      .then(d => setHasApiKey(d.hasKey))
      .catch(() => setHasApiKey(false));
    getVaultSKUs(siteId).then(s => setVaultCount(s.length)).catch(() => {});
  }, [siteId]);

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
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as Record<string, string>).error || 'Scan gagal');
      const scanData = data as ScanResult;

      setScanResult(scanData);
      setMarketPrice(scanData.marketPrice);
      setCondition(scanData.suggestedCondition);
      setPhase('result');

      const checkRes = await fetch('/api/stocklens/check-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, sku: scanData.sku }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setDuplicate({ skuId: checkData.skuId, existingData: checkData.existingData });
      }
    } catch (e: unknown) {
      logger.error('stocklens.scanner.scan.failed', { siteId, error: e });
      toast.error(e instanceof Error ? e.message : 'Scan gagal. Coba lagi.');
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
      const storage = getStorage();
      const unitDocId = crypto.randomUUID();
      const storageRef = ref(storage, `sites/${siteId}/${STOCKLENS_STORAGE}/${unitDocId}/${imageFile.name}`);
      await uploadBytes(storageRef, imageFile);
      const photoUrl = await getDownloadURL(storageRef);

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

      await createVaultUnit(siteId, skuId, {
        skuId,
        condition,
        marketPrice,
        photoUrl,
        year: yearSuffix || undefined,
      });

      setPhase('saved');
      toast.success('Berhasil disimpan ke Vault');
    } catch (e: unknown) {
      logger.error('stocklens.scanner.save.failed', { siteId, error: e });
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Scanner</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Scan produk dengan AI untuk auto-identifikasi nama, brand, kategori, dan harga</p>
      </div>

      {/* API key warning */}
      {hasApiKey === false && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Gemini API Key belum dikonfigurasi</p>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">Atur API Key di Settings sebelum melakukan scan. <Link href="/admin/stocklens/settings" className="underline font-medium">Buka Settings →</Link></p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Scanner panel */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-6 space-y-5">
          {phase === 'upload' && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Scan Produk Baru</span>
              </div>
              <ScanUploader onImageReady={handleImageReady} scanning={scanning} />
            </>
          )}

          {phase === 'result' && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">Hasil Analisa AI</span>
                </div>
                <button onClick={handleReset} className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
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
                disabled={saving || !!duplicate || isViewOnly}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan ke Vault</>}
              </button>
            </div>
          )}

          {phase === 'saved' && (
            <div className="space-y-4 text-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Tersimpan ke Vault!</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Produk berhasil ditambahkan ke inventory</p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button onClick={handleReset} className="flex items-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition">
                  <RotateCcw className="w-4 h-4" /> Scan Lagi
                </button>
                <Link href="/admin/stocklens/vault" className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition">
                  <Vault className="w-4 h-4" /> Lihat Vault
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Compact info row */}
        {phase === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Box className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{vaultCount}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">SKU di Vault</p>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI Vision</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Gemini + Google Search</p>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Auto-detect</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Nama, brand, harga, SKU</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
