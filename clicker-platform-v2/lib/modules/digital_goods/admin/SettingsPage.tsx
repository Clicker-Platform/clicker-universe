'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { uploadToStorage } from '@/lib/upload';
import { getSettings, saveSettings } from '../api';
import { STORAGE_FOLDER_QRIS } from '../constants';
import type { DigitalGoodsSettings } from '../types';

export default function SettingsPage() {
  const { siteId } = useSite();
  const [settings, setSettings] = useState<DigitalGoodsSettings>({
    bankName: '',
    accountNumber: '',
    accountName: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const qrisInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    getSettings(siteId)
      .then(s => { if (!cancelled && s) setSettings(s); })
      .catch(e => logger.error('digital_goods.settings.load.failed', { siteId, error: e }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  async function handleQrisUpload(file: File) {
    if (!siteId) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ kind: 'err', text: 'QRIS must be an image.' });
      return;
    }
    setUploadingQris(true);
    setMessage(null);
    try {
      const result = await uploadToStorage({ file, folder: STORAGE_FOLDER_QRIS, siteId });
      setSettings(s => ({ ...s, qrisImageUrl: result.path }));
    } catch (e) {
      logger.error('digital_goods.qris.upload.failed', { siteId, error: e });
      setMessage({ kind: 'err', text: 'QRIS upload failed.' });
    } finally {
      setUploadingQris(false);
      if (qrisInputRef.current) qrisInputRef.current.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    if (!settings.bankName.trim() || !settings.accountNumber.trim() || !settings.accountName.trim()) {
      setMessage({ kind: 'err', text: 'Bank name, account number, and account name are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings(siteId, settings);
      setMessage({ kind: 'ok', text: 'Settings saved.' });
    } catch (e) {
      logger.error('digital_goods.settings.save.failed', { siteId, error: e });
      setMessage({ kind: 'err', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 dark:text-neutral-500">Loading...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Digital Goods — Payment Settings</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500">Buyers will see these details on the checkout page.</p>
      </div>

      {message && (
        <div className={`p-3 rounded border ${
          message.kind === 'ok'
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/40 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400'
        }`}>{message.text}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Bank name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={settings.bankName}
          onChange={e => setSettings(s => ({ ...s, bankName: e.target.value }))}
          placeholder="e.g. BCA"
          className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Account number <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={settings.accountNumber}
          onChange={e => setSettings(s => ({ ...s, accountNumber: e.target.value }))}
          placeholder="e.g. 1234567890"
          className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Account holder name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={settings.accountName}
          onChange={e => setSettings(s => ({ ...s, accountName: e.target.value }))}
          placeholder="e.g. Andre Setiawan"
          className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">QRIS image (optional)</label>
        {settings.qrisImageUrl ? (
          <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3 flex items-center gap-3 bg-gray-50 dark:bg-neutral-800/50">
            <ImageIcon className="text-gray-500 dark:text-neutral-500" size={20} />
            <div className="flex-1 text-sm text-gray-700 dark:text-neutral-300 truncate">{settings.qrisImageUrl}</div>
            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, qrisImageUrl: undefined }))}
              className="p-1 text-gray-500 dark:text-neutral-500 hover:text-red-600"
              aria-label="Remove QRIS image"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <label className="block border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-lg p-6 text-center cursor-pointer hover:border-brand-dark dark:hover:border-brand-dark">
            {uploadingQris ? (
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-neutral-500">
                <Loader2 className="animate-spin" size={18} /> Uploading...
              </div>
            ) : (
              <>
                <ImageIcon className="mx-auto mb-2 text-gray-400 dark:text-neutral-600" size={24} />
                <div className="text-sm text-gray-700 dark:text-neutral-300">Click to upload QRIS image</div>
              </>
            )}
            <input
              ref={qrisInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingQris}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleQrisUpload(f);
              }}
            />
          </label>
        )}
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          Save settings
        </button>
      </div>
    </form>
  );
}
