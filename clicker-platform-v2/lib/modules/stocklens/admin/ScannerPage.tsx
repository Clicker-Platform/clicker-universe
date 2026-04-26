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
