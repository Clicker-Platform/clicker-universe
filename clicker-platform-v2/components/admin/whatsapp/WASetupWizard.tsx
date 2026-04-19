'use client';

import { useState } from 'react';
import { CheckCircle, ChevronRight, Copy, ExternalLink, Loader2, MessageCircle, AlertCircle } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';

interface SetupFormData {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  ownerPhone: string;
}

const STEPS = [
  { id: 1, title: 'Buat Meta Business Account' },
  { id: 2, title: 'Daftarkan Nomor WA Bisnis' },
  { id: 3, title: 'Generate System User Token' },
  { id: 4, title: 'Masukkan Kredensial' },
  { id: 5, title: 'Konfigurasi Webhook' },
];

export function WASetupWizard({ onComplete }: { onComplete: () => void }) {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SetupFormData>({ phoneNumberId: '', wabaId: '', accessToken: '', ownerPhone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/wa`
    : '/api/webhooks/wa';

  async function handleSave() {
    if (isViewOnly) return;
    if (!form.phoneNumberId || !form.wabaId || !form.accessToken || !form.ownerPhone) {
      setError('Semua field wajib diisi.');
      return;
    }
    if (!/^\+62\d{8,13}$/.test(form.ownerPhone)) {
      setError('Nomor WA Owner harus format +62xxxxxxxxxx.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, ...form }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Gagal menyimpan konfigurasi.');
      }
      setStep(5);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Setup WhatsApp</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400">Hubungkan nomor WA bisnis kamu ke Clicker</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
              step > s.id ? 'bg-green-500 text-white' :
              step === s.id ? 'bg-blue-600 text-white' :
              'bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'
            }`}>
              {step > s.id ? <CheckCircle size={14} /> : s.id}
            </div>
            <span className={`text-xs hidden sm:block ${step === s.id ? 'text-gray-900 dark:text-neutral-100 font-medium' : 'text-gray-400 dark:text-neutral-500'}`}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 dark:text-neutral-600 ml-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-6">
        {step === 1 && (
          <StepCard
            title="Buat Meta Business Account"
            description="Kamu butuh akun Meta Business Suite untuk menggunakan WhatsApp Cloud API."
          >
            <ol className="space-y-2 text-sm text-gray-600 dark:text-neutral-400 list-decimal list-inside">
              <li>Buka <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">business.facebook.com <ExternalLink size={12} /></a></li>
              <li>Buat akun bisnis jika belum ada</li>
              <li>Pastikan akun terverifikasi dengan informasi bisnis yang valid</li>
            </ol>
            <StepNavigation onNext={() => setStep(2)} />
          </StepCard>
        )}

        {step === 2 && (
          <StepCard
            title="Daftarkan Nomor WA Bisnis"
            description="Tambahkan nomor WhatsApp bisnis kamu di Meta Developer Console."
          >
            <ol className="space-y-2 text-sm text-gray-600 dark:text-neutral-400 list-decimal list-inside">
              <li>Buka <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">developers.facebook.com <ExternalLink size={12} /></a></li>
              <li>Buat App baru → pilih "Business" type</li>
              <li>Tambahkan produk "WhatsApp"</li>
              <li>Di menu WhatsApp → Getting Started, catat <strong>Phone Number ID</strong> dan <strong>WhatsApp Business Account ID</strong></li>
            </ol>
            <StepNavigation onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </StepCard>
        )}

        {step === 3 && (
          <StepCard
            title="Generate System User Token"
            description="Gunakan System User Token (permanent) — bukan User Access Token yang expire."
          >
            <ol className="space-y-2 text-sm text-gray-600 dark:text-neutral-400 list-decimal list-inside">
              <li>Di Meta Business Suite → Settings → System Users</li>
              <li>Buat System User baru (role: Admin)</li>
              <li>Klik "Add Assets" → tambahkan WhatsApp account kamu</li>
              <li>Generate token dengan permission: <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded text-xs">whatsapp_business_messaging</code> dan <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded text-xs">whatsapp_business_management</code></li>
              <li>Copy token — simpan aman, tidak bisa dilihat lagi setelah ditutup</li>
            </ol>
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Jangan gunakan Personal Access Token. System User Token tidak expire.
            </div>
            <StepNavigation onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </StepCard>
        )}

        {step === 4 && (
          <StepCard
            title="Masukkan Kredensial"
            description="Token akan dienkripsi sebelum disimpan. Tidak ada yang bisa membacanya dari dashboard."
          >
            <div className="space-y-4">
              <Field label="Phone Number ID" value={form.phoneNumberId} onChange={v => setForm(f => ({ ...f, phoneNumberId: v }))} placeholder="1234567890" />
              <Field label="WhatsApp Business Account ID (WABA ID)" value={form.wabaId} onChange={v => setForm(f => ({ ...f, wabaId: v }))} placeholder="9876543210" />
              <Field label="System User Access Token" value={form.accessToken} onChange={v => setForm(f => ({ ...f, accessToken: v }))} placeholder="EAA..." type="password" />
              <PhoneField label="Nomor WA Owner" value={form.ownerPhone} onChange={v => setForm(f => ({ ...f, ownerPhone: v }))} helper="Nomor ini dipakai untuk Owner Command Mode — chat ke nomor bisnis untuk query data." />
            </div>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100">
                Kembali
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Simpan & Lanjut
              </button>
            </div>
          </StepCard>
        )}

        {step === 5 && (
          <StepCard
            title="Konfigurasi Webhook"
            description="Daftarkan URL webhook ini di Meta Developer Console agar pesan masuk diterima Clicker."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Webhook URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-xs text-gray-800 dark:text-neutral-200 font-mono overflow-x-auto">
                    {webhookUrl}
                  </code>
                  <button onClick={copyWebhookUrl} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors" title="Copy">
                    {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-500" />}
                  </button>
                </div>
              </div>
              <ol className="space-y-2 text-sm text-gray-600 dark:text-neutral-400 list-decimal list-inside">
                <li>Di Meta Developer Console → WhatsApp → Configuration</li>
                <li>Masukkan Webhook URL di atas</li>
                <li>Verify Token: gunakan token unik yang sudah dikonfigurasi Clicker</li>
                <li>Subscribe ke field: <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded text-xs">messages</code></li>
                <li>Klik Verify & Save</li>
              </ol>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400">
                ✅ Kredensial berhasil disimpan. Setelah webhook dikonfigurasi, pesan WA akan masuk ke inbox Clicker.
              </div>
            </div>
            <div className="mt-6">
              <button onClick={onComplete} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                Selesai Setup
              </button>
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}

function StepCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-neutral-100 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">{description}</p>
      {children}
    </div>
  );
}

function StepNavigation({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  return (
    <div className="mt-6 flex gap-3">
      {onBack && <button onClick={onBack} className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100">Kembali</button>}
      {onNext && <button onClick={onNext} className="flex items-center gap-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Lanjut <ChevronRight size={14} /></button>}
    </div>
  );
}

function formatPhoneE164(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('62') && !digits.startsWith('+')) digits = '+' + digits;
  if (!digits.startsWith('+')) digits = '+62' + digits;
  return digits;
}

function PhoneField({ label, value, onChange, helper }: {
  label: string; value: string; onChange: (v: string) => void; helper?: string;
}) {
  const valid = /^\+62\d{8,13}$/.test(value);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">{label}</label>
      <input
        type="tel"
        value={value}
        onChange={e => onChange(formatPhoneE164(e.target.value))}
        placeholder="+628123456789"
        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          value && !valid
            ? 'border-red-400 dark:border-red-600'
            : 'border-gray-300 dark:border-neutral-700'
        }`}
      />
      {value && !valid && (
        <p className="mt-1 text-xs text-red-500">Format harus +62xxxxxxxxxx</p>
      )}
      {helper && <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">{helper}</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', helper }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {helper && <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">{helper}</p>}
    </div>
  );
}
