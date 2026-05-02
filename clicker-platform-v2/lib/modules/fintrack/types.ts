import { Timestamp } from 'firebase/firestore';

export type EntryJenis = 'pemasukan' | 'pengeluaran';
export type DebtJenis = 'hutang' | 'piutang';
export type BudgetPeriode = 'bulanan' | 'tahunan';
export type RecurringFrekuensi = 'harian' | 'mingguan' | 'bulanan' | 'tahunan';

export interface Wallet {
  id: string;
  nama: string;
  tipe: string;
  icon: string;
  warna: string;
  saldoAwal: number;
  createdAt: Timestamp;
}

export interface FintrackEntry {
  id: string;
  walletId: string;
  jumlah: number;
  jenis: EntryJenis;
  kategori: string;
  judul: string;
  catatan?: string;
  buktiUrl?: string;
  tanggal: string;
  isRecurring: boolean;
  recurringId?: string;
  createdAt: Timestamp;
}

export interface Transfer {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  jumlah: number;
  catatan?: string;
  tanggal: string;
  createdAt: Timestamp;
}

export interface FintrackCategory {
  id: string;
  nama: string;
  icon: string;
  warna: string;
  isDefault: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  jumlah: number;
  periode: BudgetPeriode;
  bulan?: number;
  tahun: number;
  createdAt: Timestamp;
}

export interface Goal {
  id: string;
  nama: string;
  target: number;
  terkumpul: number;
  deadline?: string;
  icon: string;
  createdAt: Timestamp;
}

export interface Debt {
  id: string;
  nama: string;
  jenis: DebtJenis;
  jumlah: number;
  lunas: boolean;
  catatan?: string;
  deadline?: string;
  createdAt: Timestamp;
}

export interface Recurring {
  id: string;
  walletId: string;
  judul: string;
  jumlah: number;
  jenis: EntryJenis;
  kategori: string;
  frekuensi: RecurringFrekuensi;
  tglMulai: string;
  tglBerikut: string;
  aktif: boolean;
  createdAt: Timestamp;
}

export interface ReceiptScanResult {
  jumlah: number;
  tanggal: string;
  catatan: string;
  toko: string;
  buktiUrl?: string;
}
