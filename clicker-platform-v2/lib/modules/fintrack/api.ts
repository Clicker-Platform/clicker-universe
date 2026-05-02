import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Wallet, FintrackEntry, Transfer, FintrackCategory,
  Budget, Goal, Debt, Recurring,
} from './types';
import {
  FT_WALLETS, FT_ENTRIES, FT_TRANSFERS, FT_CATEGORIES,
  FT_BUDGETS, FT_GOALS, FT_DEBTS, FT_RECURRING, DEFAULT_CATEGORIES,
} from './constants';

// ── Wallets ───────────────────────────────────────────────────────────────────

export async function getWallets(siteId: string): Promise<Wallet[]> {
  const q = query(collection(db, 'sites', siteId, FT_WALLETS), orderBy('createdAt'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Wallet));
}

export async function createWallet(siteId: string, data: Omit<Wallet, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, FT_WALLETS), {
    ...data, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateWallet(siteId: string, walletId: string, data: Partial<Omit<Wallet, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'sites', siteId, FT_WALLETS, walletId), data);
}

export async function deleteWallet(siteId: string, walletId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_WALLETS, walletId));
}

export async function getWalletBalance(siteId: string, walletId: string): Promise<number> {
  const walletSnap = await getDoc(doc(db, 'sites', siteId, FT_WALLETS, walletId));
  if (!walletSnap.exists()) return 0;
  const saldoAwal = walletSnap.data().saldoAwal || 0;

  const q = query(collection(db, 'sites', siteId, FT_ENTRIES), where('walletId', '==', walletId));
  const snap = await getDocs(q);
  let balance = saldoAwal;
  snap.docs.forEach(d => {
    const entry = d.data();
    if (entry.jenis === 'pemasukan') balance += entry.jumlah;
    else balance -= entry.jumlah;
  });
  return balance;
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getEntries(siteId: string, filters?: { bulan?: number; tahun?: number }): Promise<FintrackEntry[]> {
  const q = query(
    collection(db, 'sites', siteId, FT_ENTRIES),
    orderBy('tanggal', 'desc'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  let entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as FintrackEntry));
  if (filters?.bulan && filters?.tahun) {
    const prefix = `${filters.tahun}-${String(filters.bulan).padStart(2, '0')}`;
    entries = entries.filter(e => e.tanggal.startsWith(prefix));
  }
  return entries;
}

export async function createEntry(siteId: string, data: Omit<FintrackEntry, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, FT_ENTRIES), {
    ...data, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEntry(siteId: string, entryId: string, data: Partial<Omit<FintrackEntry, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'sites', siteId, FT_ENTRIES, entryId), data);
}

export async function deleteEntry(siteId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_ENTRIES, entryId));
}

// ── Transfers ─────────────────────────────────────────────────────────────────

export async function getTransfers(siteId: string): Promise<Transfer[]> {
  const q = query(collection(db, 'sites', siteId, FT_TRANSFERS), orderBy('tanggal', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transfer));
}

export async function createTransfer(siteId: string, data: Omit<Transfer, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'sites', siteId, FT_TRANSFERS), {
    ...data, createdAt: serverTimestamp(),
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(siteId: string): Promise<FintrackCategory[]> {
  const q = query(collection(db, 'sites', siteId, FT_CATEGORIES), orderBy('nama'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FintrackCategory));
}

export async function seedDefaultCategories(siteId: string): Promise<void> {
  const existing = await getDocs(collection(db, 'sites', siteId, FT_CATEGORIES));
  if (!existing.empty) return;
  await Promise.all(DEFAULT_CATEGORIES.map(cat =>
    addDoc(collection(db, 'sites', siteId, FT_CATEGORIES), cat)
  ));
}

export async function createCategory(siteId: string, data: Omit<FintrackCategory, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, FT_CATEGORIES), data);
  return ref.id;
}

export async function deleteCategory(siteId: string, categoryId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_CATEGORIES, categoryId));
}

// ── Budget ────────────────────────────────────────────────────────────────────

export async function getBudgets(siteId: string): Promise<Budget[]> {
  const q = query(collection(db, 'sites', siteId, FT_BUDGETS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget));
}

export async function createBudget(siteId: string, data: Omit<Budget, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'sites', siteId, FT_BUDGETS), { ...data, createdAt: serverTimestamp() });
}

export async function deleteBudget(siteId: string, budgetId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_BUDGETS, budgetId));
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function getGoals(siteId: string): Promise<Goal[]> {
  const q = query(collection(db, 'sites', siteId, FT_GOALS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
}

export async function createGoal(siteId: string, data: Omit<Goal, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, FT_GOALS), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateGoal(siteId: string, goalId: string, data: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'sites', siteId, FT_GOALS, goalId), data);
}

export async function deleteGoal(siteId: string, goalId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_GOALS, goalId));
}

// ── Debts ─────────────────────────────────────────────────────────────────────

export async function getDebts(siteId: string): Promise<Debt[]> {
  const q = query(collection(db, 'sites', siteId, FT_DEBTS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt));
}

export async function createDebt(siteId: string, data: Omit<Debt, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'sites', siteId, FT_DEBTS), { ...data, createdAt: serverTimestamp() });
}

export async function updateDebt(siteId: string, debtId: string, data: Partial<Omit<Debt, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'sites', siteId, FT_DEBTS, debtId), data);
}

export async function deleteDebt(siteId: string, debtId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_DEBTS, debtId));
}

// ── Recurring ─────────────────────────────────────────────────────────────────

export async function getRecurring(siteId: string): Promise<Recurring[]> {
  const q = query(collection(db, 'sites', siteId, FT_RECURRING), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recurring));
}

export async function createRecurring(siteId: string, data: Omit<Recurring, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'sites', siteId, FT_RECURRING), { ...data, createdAt: serverTimestamp() });
}

export async function updateRecurring(siteId: string, recurringId: string, data: Partial<Omit<Recurring, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'sites', siteId, FT_RECURRING, recurringId), data);
}

export async function deleteRecurring(siteId: string, recurringId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, FT_RECURRING, recurringId));
}
