'use client';

import Image from 'next/image';
import { ImageIcon, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { MarketingAsset } from '../types';

interface Props {
  assets: MarketingAsset[];
  onSelect?: (asset: MarketingAsset) => void;
}

const STATUS_BADGE: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pending:   { icon: <Clock className="w-3 h-3" />,        label: 'Pending',   className: 'bg-gray-100 border-gray-200 text-gray-500' },
  analyzing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Analyzing', className: 'bg-blue-50 border-blue-200 text-blue-600' },
  complete:  { icon: <CheckCircle2 className="w-3 h-3" />, label: 'Analyzed',  className: 'bg-green-50 border-green-200 text-green-700' },
  failed:    { icon: <AlertCircle className="w-3 h-3" />,  label: 'Failed',    className: 'bg-red-50 border-red-200 text-red-600' },
};

const TYPE_LABEL: Record<string, string> = {
  model: 'Model', product: 'Product', background: 'Background',
};

export default function AssetGrid({ assets, onSelect }: Props) {
  if (assets.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center">
        <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No assets yet</p>
        <p className="text-gray-400 text-sm mt-1">Upload your first marketing asset above</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {assets.map(asset => {
        const status = STATUS_BADGE[asset.analysisStatus] ?? STATUS_BADGE.pending;
        return (
          <div
            key={asset.id}
            onClick={() => onSelect?.(asset)}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
          >
            {/* Thumbnail */}
            <div className="relative aspect-square bg-gray-50">
              <Image
                src={asset.thumbnailUrl || asset.fileUrl}
                alt={asset.fileName}
                fill
                className="object-cover"
              />
              <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-black/60 text-white">
                  {TYPE_LABEL[asset.type] ?? asset.type}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700 truncate">{asset.fileName}</p>

              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${status.className}`}>
                  {status.icon}
                  {status.label}
                </div>
                <span className="text-xs text-gray-400">{asset.fileSizeMB.toFixed(1)} MB</span>
              </div>

              {/* Color swatches (if analyzed) */}
              {asset.analysis?.colors && asset.analysis.colors.length > 0 && (
                <div className="flex gap-1">
                  {asset.analysis.colors.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      title={c.name}
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
