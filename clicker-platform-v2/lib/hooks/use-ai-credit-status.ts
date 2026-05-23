'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
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
  const [registeredModules, setRegisteredModules] = useState<Set<string>>(new Set());
  const [siteEnabled, setSiteEnabled] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // bumped by refresh() / focus

  // Subscribe to globally-registered modules
  useEffect(() => {
    const unsub = subscribeToEnabledModules((mods) => {
      setRegisteredModules(new Set(mods.map(m => m.id)));
    });
    return () => unsub();
  }, []);

  // Subscribe to per-site module flags
  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const unsub = onSnapshot(doc(db, 'sites', siteId), (snap) => {
      if (!snap.exists()) { setSiteEnabled({}); return; }
      const d = snap.data() as { modules?: Record<string, boolean>; settings?: { modules?: Record<string, boolean> } };
      setSiteEnabled({ ...(d.settings?.modules ?? {}), ...(d.modules ?? {}) });
    });
    return () => unsub();
  }, [siteId]);

  // Module-gating check: is this tenant eligible to fetch AI credit data?
  const gatingEnabled = useMemo(() => {
    for (const id of AI_CONSUMER_MODULE_IDS) {
      if (registeredModules.has(id) && siteEnabled[id]) return true;
    }
    return false;
  }, [registeredModules, siteEnabled]);

  // Fetch when gating allows
  useEffect(() => {
    if (!gatingEnabled || !siteId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch('/api/admin/ai-credits', {
          headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
        });
        if (!res.ok) { setLoading(false); return; }
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) { setData(json); setLoading(false); }
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

  // shouldRender: gating is met AND we have fetched data at least once (or debt scenario).
  // Using `data !== null` ensures shouldRender only flips to true after the first fetch
  // completes — consumers can then safely read `state` without racing the async fetch.
  // The debt safety case (balance < 0) overrides even if gating is not met.
  const shouldRender = gatingEnabled
    ? data !== null
    : (data !== null && data.balance < 0);

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
