'use client';

import { useState, useEffect } from 'react';
import { ImageIcon, Plus, HardDrive, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { useRouter } from 'next/navigation';
import { subscribeAssets } from '../api';
import { MarketingAsset } from '../types';
import { MAX_STORAGE_MB, ROUTES } from '../constants';
import AssetGrid from '../components/AssetGrid';
import AssetUploadModal from '../components/AssetUploadModal';

export default function AssetsPage() {
  const { siteId } = useSite();
  const { canEdit } = useUser();
  const router = useRouter();

  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    const unsub = subscribeAssets(siteId, (data) => {
      setAssets(data);
      setLoading(false);
    });
    return unsub;
  }, [siteId]);

  const totalUsedMB = assets.reduce((s, a) => s + (a.fileSizeMB ?? 0), 0);
  const usedPercent = Math.min((totalUsedMB / MAX_STORAGE_MB) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Marketing Assets</h1>
            <p className="text-sm text-gray-500">Upload brand photos, backgrounds, and product images for AI analysis</p>
          </div>
        </div>
        {canEdit('ai_marketing', 'assets') && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark/90 shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Upload Asset
          </button>
        )}
      </div>

      {/* Storage indicator */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span>Storage</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">
            {totalUsedMB.toFixed(1)} MB / {MAX_STORAGE_MB} MB
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usedPercent > 85 ? 'bg-red-500' : usedPercent > 60 ? 'bg-amber-400' : 'bg-green-500'}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <AssetGrid
          assets={assets}
          onSelect={(asset) => router.push(`${ROUTES.assetDetail}?id=${asset.id}`)}
        />
      )}

      {showUpload && (
        <AssetUploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={(_assetId) => {
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}
