'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';
import { getWallets, getCategories, createEntry, seedDefaultCategories } from '../api';
import { Wallet, FintrackCategory, EntryJenis } from '../types';
import { Save, X } from 'lucide-react';

export default function NewEntryPage() {
  const { siteId } = useSite();
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<FintrackCategory[]>([]);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    jenis: 'pengeluaran' as EntryJenis,
    jumlah: '',
    judul: '',
    kategori: '',
    walletId: '',
    tanggal: today,
    catatan: '',
  });

  useEffect(() => {
    if (!siteId) return;
    Promise.all([
      getWallets(siteId),
      seedDefaultCategories(siteId).then(() => getCategories(siteId)),
    ]).then(([ws, cats]) => {
      setWallets(ws);
      setCategories(cats);
      if (ws[0]) setForm(p => ({ ...p, walletId: ws[0].id }));
      if (cats[0]) setForm(p => ({ ...p, kategori: cats[0].nama }));
    });
  }, [siteId]);

  async function handleSave() {
    if (!form.jumlah || !form.walletId) return toast.error('Jumlah dan dompet wajib diisi');
    setSaving(true);
    try {
      await createEntry(siteId, {
        walletId: form.walletId,
        jumlah: Number(form.jumlah),
        jenis: form.jenis,
        kategori: form.kategori,
        judul: form.judul || form.kategori,
        catatan: form.catatan,
        tanggal: form.tanggal,
        isRecurring: false,
      });
      toast.success('Transaksi disimpan');
      router.push('/admin/fintrack/entries');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold dark:text-white">Transaksi Baru</h1>

      <div className="flex gap-2">
        {(['pengeluaran', 'pemasukan'] as EntryJenis[]).map(j => (
          <button key={j} onClick={() => setForm(p => ({ ...p, jenis: j }))}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
              form.jenis === j
                ? j === 'pengeluaran' ? 'bg-red-500 border-red-500 text-white' : 'bg-green-500 border-green-500 text-white'
                : 'border-gray-200 dark:border-neutral-700 dark:text-white'
            }`}>
            {j === 'pengeluaran' ? '↘ Pengeluaran' : '↗ Pemasukan'}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Jumlah (Rp)*</label>
        <input type="number" className="w-full mt-1 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2"
          value={form.jumlah} onChange={e => setForm(p => ({ ...p, jumlah: e.target.value }))} placeholder="0" />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Judul</label>
        <input className="w-full mt-1 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2"
          value={form.judul} onChange={e => setForm(p => ({ ...p, judul: e.target.value }))} placeholder="Contoh: Makan siang" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Kategori</label>
          <select className="w-full mt-1 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
            value={form.kategori} onChange={e => setForm(p => ({ ...p, kategori: e.target.value }))}>
            {categories.map(c => <option key={c.id} value={c.nama}>{c.icon} {c.nama}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Tanggal</label>
          <input type="date" className="w-full mt-1 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
            value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Dompet*</label>
        <select className="w-full mt-1 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2"
          value={form.walletId} onChange={e => setForm(p => ({ ...p, walletId: e.target.value }))}>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.nama}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Catatan</label>
        <textarea className="w-full mt-1 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm" rows={2}
          value={form.catatan} onChange={e => setForm(p => ({ ...p, catatan: e.target.value }))} />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={() => router.back()} className="flex items-center gap-2 px-4 py-2 border dark:border-neutral-700 dark:text-white rounded-lg text-sm">
          <X className="w-4 h-4" /> Batal
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </div>
    </div>
  );
}
