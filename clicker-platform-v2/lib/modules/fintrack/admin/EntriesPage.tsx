'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { getEntries, getWallets, deleteEntry } from '../api';
import { FintrackEntry, Wallet } from '../types';
import { PlusCircle, Trash2, Search } from 'lucide-react';
import Link from 'next/link';

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }

export default function EntriesPage() {
  const { siteId } = useSite();
  const { isViewOnly } = usePermission();
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [entries, setEntries] = useState<FintrackEntry[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState<'semua' | 'pemasukan' | 'pengeluaran'>('semua');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const [es, ws] = await Promise.all([getEntries(siteId, { bulan, tahun }), getWallets(siteId)]);
    setEntries(es);
    setWallets(ws);
    setLoading(false);
  }, [siteId, bulan, tahun]);

  useEffect(() => { load(); }, [load]);

  const walletMap = Object.fromEntries(wallets.map(w => [w.id, w]));

  const filtered = entries.filter(e => {
    if (filterJenis !== 'semua' && e.jenis !== filterJenis) return false;
    if (search && !e.judul?.toLowerCase().includes(search.toLowerCase()) && !e.catatan?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groups: Record<string, FintrackEntry[]> = {};
  filtered.forEach(e => {
    if (!groups[e.tanggal]) groups[e.tanggal] = [];
    groups[e.tanggal].push(e);
  });

  async function handleDelete(e: FintrackEntry) {
    if (!confirm('Hapus transaksi ini?')) return;
    await deleteEntry(siteId, e.id);
    toast.success('Transaksi dihapus');
    load();
  }

  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Riwayat Transaksi</h1>
        {!isViewOnly && (
          <Link href="/admin/fintrack/new" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
            <PlusCircle className="w-4 h-4" /> Tambah
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <select className="border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
          value={bulan} onChange={e => setBulan(Number(e.target.value))}>
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
          value={tahun} onChange={e => setTahun(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(['semua', 'pengeluaran', 'pemasukan'] as const).map(f => (
          <button key={f} onClick={() => setFilterJenis(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterJenis === f ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 dark:border-neutral-700 dark:text-gray-300'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-7 pr-3 py-1.5 border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-full text-xs"
            placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Memuat...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><p>Tidak ada transaksi untuk periode ini.</p></div>
      ) : (
        Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([date, es]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{date}</p>
            <div className="space-y-2">
              {es.map(e => {
                const w = walletMap[e.walletId];
                return (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-xl border border-gray-100 dark:border-neutral-700">
                    <div>
                      <p className="font-medium text-sm dark:text-white">{e.judul || e.kategori}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{e.kategori} · {w ? `${w.icon} ${w.nama}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm ${e.jenis === 'pemasukan' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {e.jenis === 'pemasukan' ? '+' : '-'}{formatRp(e.jumlah)}
                      </span>
                      {!isViewOnly && (
                        <button onClick={() => handleDelete(e)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
