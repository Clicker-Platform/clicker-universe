'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { usdToCredits } from '@/lib/ai/credits-display';
import {
  AI_CONSUMER_MODULE_IDS,
  PCT_WARN,
  PCT_CRITICAL,
  USD_WARN_FALLBACK,
  USD_CRITICAL_FALLBACK,
} from '@/components/admin/ai-credit/constants';

export type CreditState = 'healthy' | 'warn' | 'critical' | 'out';

export interface AICreditStatus {
  loading: boolean;
  shouldRender: boolean;
  state: CreditState;
  balanceUSD: number;
  balanceCredits: number;
  /** 0–1, undefined if no baseline known */
  pct: number | undefined;
  refresh: () => void;
}

interface ApiResponse { balance: number; lifetimeUsed: number; }

// sessionStorage cache: shows the last-known balance immediately on remount
// while a fresh fetch runs in the background. Eliminates the perceived
// cold-start delay (Firestore snapshot + token mint + API round-trip).
const CACHE_KEY = (siteId: string) => `clicker_ai_credit_status_${siteId}`;

function readCache(siteId: string): ApiResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.balance === 'number' && typeof parsed?.lifetimeUsed === 'number') {
      return { balance: parsed.balance, lifetimeUsed: parsed.lifetimeUsed };
    }
    return null;
  } catch { return null; }
}

function writeCache(siteId: string, value: ApiResponse): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(CACHE_KEY(siteId), JSON.stringify(value)); } catch {}
}

function classify(balanceUSD: number, lifetimeUsedUSD: number): { state: CreditState; pct: number | undefined } {
  if (balanceUSD <= 0) return { state: 'out', pct: 0 };

  // Baseline = highest "full tank" we've seen for this tenant.
  // lifetimeUsed + balance is a decent proxy for "everything ever granted".
  const baseline = lifetimeUsedUSD + balanceUSD;
  if (baseline > 0) {
    const pct = balanceUSD / baseline;
    if (pct < PCT_CRITICAL) return { state: 'critical', pct };
    if (pct < PCT_WARN) return { state: 'warn', pct };
    return { state: 'healthy', pct };
  }

  // Fallback when no usage history yet
  if (balanceUSD <= USD_CRITICAL_FALLBACK) return { state: 'critical', pct: undefined };
  if (balanceUSD <= USD_WARN_FALLBACK) return { state: 'warn', pct: undefined };
  return { state: 'healthy', pct: undefined };
}

export function useAICreditStatus(): AICreditStatus {
  const { siteId } = useSite();
  const [siteEnabled, setSiteEnabled] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // bumped by refresh() / focus

  // Subscribe to per-site module flags.
  // We deliberately do NOT consult the global module registry — gating only
  // needs to know whether the tenant has the module flag enabled. Skipping
  // that second subscription removes one network round-trip from the cold
  // path before the pill can render.
  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const unsub = onSnapshot(doc(db, 'sites', siteId), (snap) => {
      if (!snap.exists()) { setSiteEnabled({}); return; }
      const d = snap.data() as { modules?: Record<string, boolean>; settings?: { modules?: Record<string, boolean> } };
      setSiteEnabled({ ...(d.settings?.modules ?? {}), ...(d.modules ?? {}) });
    });
    return () => unsub();
  }, [siteId]);

  const gatingEnabled = useMemo(
    () => AI_CONSUMER_MODULE_IDS.some(id => siteEnabled[id]),
    [siteEnabled],
  );

  // Hydrate from sessionStorage on siteId change — shows the previous-session
  // balance instantly while the background fetch runs.
  useEffect(() => {
    if (!siteId) { setData(null); return; }
    const cached = readCache(siteId);
    setData(cached);
  }, [siteId]);

  // Fetch when gating allows
  useEffect(() => {
    if (!gatingEnabled || !siteId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { if (!cancelled) setLoading(false); return; }
        const res = await fetch('/api/admin/ai-credits', {
          headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
        });
        if (!res.ok) { if (!cancelled) setLoading(false); return; }
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) {
          setData(json);
          writeCache(siteId, json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gatingEnabled, siteId, tick]);

  // Refresh on tab becoming visible
  useEffect(() => {
    if (!gatingEnabled) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick(t => t + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [gatingEnabled]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const balanceUSD = data?.balance ?? 0;
  const lifetimeUsedUSD = data?.lifetimeUsed ?? 0;
  const { state, pct } = classify(balanceUSD, lifetimeUsedUSD);

  // shouldRender flips true as soon as gating allows AND we have any data
  // (either cached or freshly fetched). Cached hydration means this is
  // typically instantaneous on warm sessions.
  const shouldRender = gatingEnabled && data !== null;

  return {
    loading,
    shouldRender,
    state,
    balanceUSD,
    balanceCredits: usdToCredits(balanceUSD),
    pct,
    refresh,
  };
}
