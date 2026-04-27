'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { Wallet } from '../types';
import { getWallets, createWallet, updateWallet, deleteWallet, getWalletBalance } from '../api';
import { WALLET_TYPE_SUGGESTIONS, WALLET_ICONS, WALLET_COLORS } from '../constants';
import { PlusCircle, Pencil, Trash2, Wallet as WalletIcon } from 'lucide-react';

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function WalletVaultPage() {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [form, setForm] = useState({ nama: '', tipe: '', icon: '🏦', warna: WALLET_COLORS[0], saldoAwal: '' });

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const ws = await getWallets(siteId);
    setWallets(ws);
    const bals: Record<string, number> = {};
    await Promise.all(ws.map(async w => { bals[w.id] = await getWalletBalance(siteId, w.id); }));
    setBalances(bals);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ nama: '', tipe: '', icon: '🏦', warna: WALLET_COLORS[0], saldoAwal: '' });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(w: Wallet) {
    setForm({ nama: w.nama, tipe: w.tipe, icon: w.icon, warna: w.warna, saldoAwal: String(w.saldoAwal) });
    setEditing(w);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.nama.trim()) return toast.error('Nama dompet wajib diisi');
    const data = { nama: form.nama.trim(), tipe: form.tipe, icon: form.icon, warna: form.warna, saldoAwal: Number(form.saldoAwal) || 0 };
    if (editing) {
      await updateWallet(siteId, editing.id, data);
      toast.success('Dompet diperbarui');
    } else {
      await createWallet(siteId, data);
      toast.success('Dompet ditambahkan');
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(w: Wallet) {
    if (!confirm(`Hapus dompet "${w.nama}"?`)) return;
    await deleteWallet(siteId, w.id);
    toast.success('Dompet dihapus');
    load();
  }

  const totalSaldo = Object.values(balances).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            <WalletIcon className="w-6 h-6" /> Vault Dompet
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total semua: {formatRp(totalSaldo)}</p>
        </div>
        {!isViewOnly && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
            <PlusCircle className="w-4 h-4" /> Tambah Dompet
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Memuat...</p>
      ) : wallets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <WalletIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Belum ada dompet. Tambahkan yang pertama!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map(w => (
            <div key={w.id} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{w.icon}</span>
                <div>
                  <p className="font-semibold dark:text-white">{w.nama}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{w.tipe || 'Umum'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-bold text-lg dark:text-white">{formatRp(balances[w.id] ?? w.saldoAwal)}</p>
                {!isViewOnly && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(w)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(w)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold dark:text-white">{editing ? 'Edit Dompet' : 'Tambah Dompet'}</h2>
            <input
              className="w-full border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Nama dompet*"
              value={form.nama}
              onChange={e => setForm(p => ({ ...p, nama: e.target.value }))}
            />
            <input
              className="w-full border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Tipe (Bank, E-Wallet, Cash...)"
              value={form.tipe}
              onChange={e => setForm(p => ({ ...p, tipe: e.target.value }))}
              list="tipe-list"
            />
            <datalist id="tipe-list">
              {WALLET_TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}
            </datalist>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Icon</p>
              <div className="flex gap-2 flex-wrap">
                {WALLET_ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                    className={`text-xl p-1.5 rounded-lg border-2 ${form.icon === ic ? 'border-amber-500' : 'border-transparent'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Warna</p>
              <div className="flex gap-2">
                {WALLET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, warna: c }))}
                    className={`w-7 h-7 rounded-full border-2 ${form.warna === c ? 'border-black dark:border-white' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <input
              type="number"
              className="w-full border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
              placeholder="Saldo awal"
              value={form.saldoAwal}
              onChange={e => setForm(p => ({ ...p, saldoAwal: e.target.value }))}
            />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border dark:border-neutral-700 dark:text-white rounded-lg text-sm">Batal</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
