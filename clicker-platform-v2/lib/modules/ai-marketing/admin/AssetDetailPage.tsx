'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ArrowLeft, Loader2, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { auth } from '@/lib/firebase';
import { getAsset, apiPost } from '../api';
import { MarketingAsset } from '../types';
import { API } from '../constants';

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { siteId } = useSite();
  const { canEdit } = useUser();

  const assetId = params.get('id');
  const [asset, setAsset] = useState<MarketingAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    if (!siteId || !assetId) return;
    getAsset(siteId, assetId).then(a => {
      setAsset(a);
      setLoading(false);
    });
  }, [siteId, assetId]);

  const handleReanalyze = async () => {
    if (!asset) return;
    setReanalyzing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // Fetch image as base64
      const imgRes = await fetch(asset.fileUrl);
      const blob = await imgRes.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const { analysis } = await apiPost(
        API.assets.analyze,
        { assetId: asset.id, assetType: asset.type, imageBase64: base64 },
        token,
        siteId
      );
      setAsset(prev => prev ? { ...prev, analysis, analysisStatus: 'complete' } : prev);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch(`${API.assets.upload}?assetId=${assetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
    });
    router.back();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  if (!asset) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center">
        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Asset not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 truncate max-w-sm">{asset.fileName}</h1>
            <p className="text-sm text-gray-500 capitalize">{asset.type} · {asset.fileSizeMB.toFixed(1)} MB</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit('ai_marketing', 'assets') && (
            <>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${reanalyzing ? 'animate-spin' : ''}`} />
                Re-analyze
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <Image src={asset.fileUrl} alt={asset.fileName} width={800} height={384} className="w-full object-contain max-h-96" />
        </div>

        {/* Analysis */}
        <div className="space-y-4">
          {asset.analysisStatus === 'analyzing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <p className="text-blue-700 font-medium text-sm">Analyzing image with AI...</p>
            </div>
          )}

          {asset.analysisStatus === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-700 text-sm font-medium">Analysis failed. Click Re-analyze to try again.</p>
            </div>
          )}

          {asset.analysis && (
            <>
              {/* Colors */}
              {asset.analysis.colors?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Color Palette</h3>
                  <div className="flex gap-2 flex-wrap">
                    {asset.analysis.colors.map((c, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div
                          className="w-10 h-10 rounded-xl border border-white shadow-md"
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                        <span className="text-xs text-gray-500 font-mono">{c.hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mood + Lighting */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">Analysis</h3>
                <div className="space-y-2 text-sm">
                  {asset.analysis.mood && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-20 shrink-0">Mood</span>
                      <span className="text-gray-900 font-medium">{asset.analysis.mood}</span>
                    </div>
                  )}
                  {asset.analysis.lighting && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-20 shrink-0">Lighting</span>
                      <span className="text-gray-900">{asset.analysis.lighting}</span>
                    </div>
                  )}
                  {asset.analysis.composition && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-20 shrink-0">Composition</span>
                      <span className="text-gray-900">{asset.analysis.composition}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Generated Prompt */}
              {asset.analysis.generatedPrompt && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
                  <h3 className="font-semibold text-gray-900 text-sm">Generated Prompt</h3>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3 font-mono text-xs">
                    {asset.analysis.generatedPrompt}
                  </p>
                </div>
              )}

              {/* Recommended Use Cases */}
              {asset.analysis.recommendedUseCases?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
                  <h3 className="font-semibold text-gray-900 text-sm">Recommended Use Cases</h3>
                  <ul className="space-y-1">
                    {asset.analysis.recommendedUseCases.map((uc: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        {uc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
