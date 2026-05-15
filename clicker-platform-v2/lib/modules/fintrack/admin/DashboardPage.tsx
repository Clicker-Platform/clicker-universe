'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSite } from '@/lib/site-context';
import { getWallets, getEntries, getWalletBalance } from '../api';
import { FintrackEntry, Wallet } from '../types';
import { TrendingUp, TrendingDown, Wallet as WalletIcon, Activity, PlusCircle } from 'lucide-react';
import Link from 'next/link';

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function shortRp(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'jt';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'rb';
  return String(n);
}

export default function DashboardPage() {
  const { siteId } = useSite();
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [_wallets, setWallets] = useState<Wallet[]>([]);
  const [entries, setEntries] = useState<FintrackEntry[]>([]);
  const [totalSaldo, setTotalSaldo] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId) return;
    await Promise.resolve().then(() => setLoading(true));
    const [ws, es] = await Promise.all([getWallets(siteId), getEntries(siteId, { bulan, tahun })]);
    setWallets(ws);
    setEntries(es);
    const bals = await Promise.all(ws.map(w => getWalletBalance(siteId, w.id)));
    setTotalSaldo(bals.reduce((a, b) => a + b, 0));
    setLoading(false);
  }, [siteId, bulan, tahun]);

  useEffect(() => { Promise.resolve().then(() => load()); }, [load]);

  const pemasukan = entries.filter(e => e.jenis === 'pemasukan').reduce((a, e) => a + e.jumlah, 0);
  const pengeluaran = entries.filter(e => e.jenis === 'pengeluaran').reduce((a, e) => a + e.jumlah, 0);
  const cashflow = pemasukan - pengeluaran;
  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const rataHarian = Math.abs(cashflow) / daysInMonth;

  const catMap: Record<string, number> = {};
  entries.filter(e => e.jenis === 'pengeluaran').forEach(e => {
    catMap[e.kategori] = (catMap[e.kategori] || 0) + e.jumlah;
  });
  const catEntries = Object.entries(catMap).sort(([, a], [, b]) => b - a).slice(0, 5);
  const catColors = ['#F97316', '#3B82F6', '#A855F7', '#EF4444', '#10B981'];

  const dayBuckets: Record<number, { masuk: number; keluar: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) dayBuckets[d] = { masuk: 0, keluar: 0 };
  entries.forEach(e => {
    const day = parseInt(e.tanggal.split('-')[2]);
    if (e.jenis === 'pemasukan') dayBuckets[day].masuk += e.jumlah;
    else dayBuckets[day].keluar += e.jumlah;
  });
  const chartDays = Object.entries(dayBuckets).map(([d, v]) => ({ day: Number(d), ...v }));
  const maxVal = Math.max(...chartDays.map(d => Math.max(d.masuk, d.keluar)), 1);

  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Dashboard Keuangan</h1>
        <div className="flex items-center gap-2">
          <select className="border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
            value={bulan} onChange={e => setBulan(Number(e.target.value))}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="border dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg px-3 py-2 text-sm"
            value={tahun} onChange={e => setTahun(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p className="text-gray-500 dark:text-gray-400">Memuat...</p> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-gray-100 dark:border-neutral-700">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                <WalletIcon className="w-4 h-4" /> Total Saldo
              </div>
              <p className="text-2xl font-bold dark:text-white">{formatRp(totalSaldo)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-gray-100 dark:border-neutral-700">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm mb-2">
                <TrendingUp className="w-4 h-4" /> Pemasukan
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatRp(pemasukan)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-gray-100 dark:border-neutral-700">
              <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm mb-2">
                <TrendingDown className="w-4 h-4" /> Pengeluaran
              </div>
              <p className="text-2xl font-bold text-red-500 dark:text-red-400">{formatRp(pengeluaran)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-gray-100 dark:border-neutral-700 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Activity className="w-4 h-4" /> Arus Kas Bersih
            </div>
            <div className="text-right">
              <p className={`text-xl font-bold ${cashflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {cashflow >= 0 ? '+' : ''}{shortRp(cashflow)}
              </p>
              <p className="text-xs text-gray-400">~{shortRp(rataHarian)}/hari</p>
            </div>
          </div>

          {catEntries.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-gray-100 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Distribusi Pengeluaran</h3>
              <div className="space-y-3">
                {catEntries.map(([cat, amt], i) => {
                  const pct = pengeluaran > 0 ? Math.round((amt / pengeluaran) * 100) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="dark:text-white">{cat}</span>
                        <span className="text-gray-500 dark:text-gray-400">{pct}% · {shortRp(amt)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: catColors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-gray-100 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Analisis Harian</h3>
            <div className="flex items-end gap-0.5 h-32">
              {chartDays.map(({ day, masuk, keluar }) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '112px' }}>
                    <div className="w-full rounded-sm bg-green-400" style={{ height: `${(masuk / maxVal) * 100}%` }} />
                    <div className="w-full rounded-sm bg-red-400" style={{ height: `${(keluar / maxVal) * 100}%` }} />
                  </div>
                  {day % 5 === 0 && <span className="text-[9px] text-gray-400">{day}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Masuk</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> Keluar</span>
            </div>
          </div>

          <Link href="/admin/fintrack/new" className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium">
            <PlusCircle className="w-5 h-5" /> Transaksi Baru
          </Link>
        </>
      )}
    </div>
  );
}
