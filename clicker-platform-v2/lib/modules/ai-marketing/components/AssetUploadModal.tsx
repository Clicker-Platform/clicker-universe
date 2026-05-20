'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, ImageIcon } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { apiPost, apiGet } from '../api';
import { API, STORAGE_FOLDER } from '../constants';
import { AssetType } from '../types';

interface Props {
  onClose: () => void;
  onUploaded: (assetId: string) => void;
}

const ASSET_TYPES: { value: AssetType; label: string; description: string }[] = [
  { value: 'model',      label: 'Model Photo',     description: 'People, lifestyle shots' },
  { value: 'product',    label: 'Product Photo',    description: 'Product images' },
  { value: 'background', label: 'Background',       description: 'Scene, environment, texture' },
];

export default function AssetUploadModal({ onClose, onUploaded }: Props) {
  const { siteId } = useSite();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<AssetType>('product');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Only image files are accepted'); return; }
    if (f.size > 20 * 1024 * 1024) { setError('Max file size is 20MB'); return; }
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      // 1. Upload to Firebase Storage (client-side, converts to WebP)
      const { url } = await uploadToStorage({
        file,
        folder: `${STORAGE_FOLDER}/${siteId}`,
        siteId,
        convertToWebP: true,
      });
      const fileName = url.split('/').pop()?.split('?')[0] ?? file.name;

      const fileSizeMB = file.size / (1024 * 1024);

      // 2. Register metadata in Firestore via API
      const { assetId } = await apiPost(
        API.assets.upload,
        {
          fileName,
          fileUrl: url,
          thumbnailUrl: url,
          fileSizeMB,
          mimeType: 'image/webp',
          type: assetType,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        },
        token,
        siteId
      );

      // 3. Trigger auto-analysis (fire-and-forget — don't block UI)
      if (preview) {
        const base64 = preview.split(',')[1];
        apiPost(API.assets.analyze, { assetId, assetType, imageBase64: base64 }, token, siteId)
          .catch(err => logger.warn('ai.marketing.asset.analyze.failed', { siteId, error: err }));
      }

      onUploaded(assetId);
    } catch (err: any) {
      if (err.message?.includes('storage_quota_exceeded')) {
        setError('Storage quota exceeded (100MB limit). Delete some assets first.');
      } else {
        setError(err.message ?? 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Upload Marketing Asset</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-300 transition-colors"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-40 mx-auto rounded-xl object-contain" />
            ) : (
              <>
                <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Drop an image here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — max 20MB</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          {/* Asset Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ASSET_TYPES.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAssetType(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    assetType === opt.value
                      ? 'border-brand-dark bg-brand-dark/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags <span className="text-gray-400 font-normal">(comma separated)</span>
            </label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="summer, promo, hero"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark/90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload & Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}
