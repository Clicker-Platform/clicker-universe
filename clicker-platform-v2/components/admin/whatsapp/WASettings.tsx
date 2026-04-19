'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { WA_ROOT, WA_CONFIG_DOC } from '@/lib/whatsapp/constants';
import type { WAConfig } from '@/lib/whatsapp/types';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, Unlink, Phone, Shield, Activity } from 'lucide-react';

function formatPhoneE164(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('62') && !digits.startsWith('+')) digits = '+' + digits;
  if (!digits.startsWith('+')) digits = '+62' + digits;
  return digits;
}

export function WASettings({ onDisconnect }: { onDisconnect: () => void }) {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();
  const [config, setConfig] = useState<WAConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const ref = doc(db, 'sites', siteId, WA_ROOT, WA_CONFIG_DOC);
    const unsub = onSnapshot(ref, snap => {
      const data = snap.data() as WAConfig | undefined;
      setConfig(data ?? null);
      setOwnerPhone(data?.ownerPhone ?? '');
      setLoading(false);
    });
    return () => unsub();
  }, [siteId]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      setTestResult({ ok: res.ok, message: data.message ?? (res.ok ? 'Koneksi berhasil!' : 'Koneksi gagal.') });
    } catch {
      setTestResult({ ok: false, message: 'Tidak dapat menghubungi server.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    if (!!isViewOnly || !siteId) return;
    if (!confirm('Apakah kamu yakin ingin memutuskan koneksi WhatsApp? Semua pesan akan tetap tersimpan.')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/admin/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      onDisconnect();
    } catch (err) {
      console.error('[WASettings] disconnect error:', err);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveOwnerPhone() {
    if (!!isViewOnly || !siteId) return;
    setSavingPhone(true);
    try {
      const ref = doc(db, 'sites', siteId, WA_ROOT, WA_CONFIG_DOC);
      await updateDoc(ref, { ownerPhone });
    } finally {
      setSavingPhone(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config) return null;

  const connectedAt = config.connectedAt
    ? new Date(config.connectedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Pengaturan WhatsApp</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Kelola koneksi WA bisnis kamu</p>
      </div>

      {/* Status card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-500 dark:text-neutral-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Status Koneksi</span>
          </div>
          <StatusBadge status={config.status} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Phone Number ID" value={maskId(config.phoneNumberId)} />
          <InfoRow label="WABA ID" value={maskId(config.wabaId)} />
          <InfoRow label="Terhubung sejak" value={connectedAt} />
          <InfoRow label="Access Token" value="••••••••••••" />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Test Koneksi
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {testResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Owner Phone */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Phone size={16} className="text-gray-500 dark:text-neutral-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Owner Command Mode</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
          Chat ke nomor bisnis kamu sendiri untuk query data Clicker (laporan, stok, booking, dll.).
        </p>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="tel"
              value={ownerPhone}
              onChange={e => setOwnerPhone(formatPhoneE164(e.target.value))}
              placeholder="+628123456789"
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                ownerPhone && !/^\+62\d{8,13}$/.test(ownerPhone)
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-gray-200 dark:border-neutral-700'
              }`}
            />
            {ownerPhone && !/^\+62\d{8,13}$/.test(ownerPhone) && (
              <p className="mt-1 text-xs text-red-500">Format harus +62xxxxxxxxxx</p>
            )}
          </div>
          <button
            onClick={handleSaveOwnerPhone}
            disabled={savingPhone || ownerPhone === config.ownerPhone || !/^\+62\d{8,13}$/.test(ownerPhone)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {savingPhone ? <Loader2 size={14} className="animate-spin" /> : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Security note */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-gray-500 dark:text-neutral-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Keamanan</span>
        </div>
        <ul className="space-y-1.5 text-xs text-gray-500 dark:text-neutral-400">
          <li className="flex items-start gap-1.5"><CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" /> Access token dienkripsi di Firestore</li>
          <li className="flex items-start gap-1.5"><CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" /> Webhook diverifikasi dengan HMAC SHA-256</li>
          <li className="flex items-start gap-1.5"><CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" /> Pesan ke customer hanya bisa dikirim oleh staff secara manual</li>
          <li className="flex items-start gap-1.5"><CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" /> Semua pesan masuk disimpan sebelum diproses</li>
        </ul>
      </div>

      {/* Disconnect */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-red-100 dark:border-red-900/30 p-5">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Putuskan Koneksi</h3>
        <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
          Menghapus koneksi WA dari Clicker. Data percakapan tetap tersimpan.
        </p>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting || !!isViewOnly}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
          Putuskan Koneksi WhatsApp
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WAConfig['status'] }) {
  const map = {
    connected: { label: 'Terhubung', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
    disconnected: { label: 'Terputus', cls: 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400' },
    error: { label: 'Error', cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  };
  const { label, cls } = map[status] ?? map.disconnected;
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm font-mono text-gray-700 dark:text-neutral-300">{value}</p>
    </div>
  );
}

function maskId(id: string): string {
  if (!id || id.length <= 6) return id;
  return id.slice(0, 4) + '••••' + id.slice(-3);
}
