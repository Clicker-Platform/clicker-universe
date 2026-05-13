'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collectionGroup, query, where, orderBy, limit, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { lookupSiteNames } from './siteNameLookup';
import type { ResendStats, StatsWindow, EmailFailure } from './types';

const WINDOW_MS: Record<StatsWindow, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

interface Options { window: StatsWindow }

export function useResendStats({ window }: Options) {
  const [data, setData] = useState<ResendStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cutoff = Timestamp.fromMillis(Date.now() - WINDOW_MS[window]);

      const aggSnap = await getDocs(query(
        collectionGroup(db, 'emailLog'),
        where('createdAt', '>=', cutoff),
      ));

      const failuresSnap = await getDocs(query(
        collectionGroup(db, 'emailLog'),
        where('status', '==', 'failed'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ));

      const recentAllSnap = await getDocs(query(
        collectionGroup(db, 'emailLog'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ));

      const perSite = new Map<string, { sent: number; failed: number; lastSentAt: Date | null }>();
      aggSnap.docs.forEach((d) => {
        const docData = d.data() as { status: 'sent' | 'failed'; siteId?: string; sentAt?: { toDate: () => Date } | null };
        const siteId = docData.siteId ?? d.ref.parent.parent?.id ?? '(unknown)';
        const row = perSite.get(siteId) ?? { sent: 0, failed: 0, lastSentAt: null };
        if (docData.status === 'sent') {
          row.sent += 1;
          const sentAt = docData.sentAt?.toDate?.() ?? null;
          if (sentAt && (!row.lastSentAt || sentAt > row.lastSentAt)) row.lastSentAt = sentAt;
        } else {
          row.failed += 1;
        }
        perSite.set(siteId, row);
      });

      const siteIds = Array.from(perSite.keys()).filter((id) => id !== '(unknown)');
      const names = await lookupSiteNames(siteIds);

      const perTenant = Array.from(perSite.entries()).map(([siteId, r]) => {
        const total = r.sent + r.failed;
        return {
          siteId,
          siteName: names[siteId] ?? null,
          sent24h: r.sent,
          failed24h: r.failed,
          failRate: total === 0 ? 0 : r.failed / total,
          lastSentAt: r.lastSentAt?.toISOString() ?? null,
        };
      }).sort((a, b) => b.failed24h - a.failed24h);

      let totalSent = 0;
      let totalFailed = 0;
      perTenant.forEach((t) => { totalSent += t.sent24h; totalFailed += t.failed24h; });

      const allDocs = [...failuresSnap.docs, ...recentAllSnap.docs];
      const allSiteIds = Array.from(new Set(allDocs.map((d) => {
        const docData = d.data() as { siteId?: string };
        return docData.siteId ?? d.ref.parent.parent?.id ?? '(unknown)';
      })));
      const newNames = await lookupSiteNames(
        allSiteIds.filter((id) => !(id in names) && id !== '(unknown)')
      );
      const allNames = { ...names, ...newNames };

      const mapDocToFailure = (d: typeof allDocs[number]): EmailFailure => {
        const docData = d.data() as Record<string, unknown>;
        const siteId = (docData.siteId as string | undefined) ?? d.ref.parent.parent?.id ?? '(unknown)';
        return {
          logId: d.id,
          siteId,
          siteName: allNames[siteId] ?? null,
          to: (docData.to as string[] | undefined) ?? [],
          cc: (docData.cc as string[] | null | undefined) ?? null,
          bcc: (docData.bcc as string[] | null | undefined) ?? null,
          subject: (docData.subject as string | undefined) ?? '',
          fromName: (docData.fromName as string | undefined) ?? '',
          fromAddress: (docData.fromAddress as string | undefined) ?? '',
          templateAlias: (docData.templateAlias as string | undefined) ?? (docData.subject as string | undefined) ?? '',
          error: (docData.error as string | null | undefined) ?? null,
          errorCode: (docData.errorCode as string | null | undefined) ?? null,
          resendId: (docData.resendId as string | null | undefined) ?? null,
          tags: (docData.tags as { name: string; value: string }[] | undefined) ?? [],
          createdAt: ((docData.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date()).toISOString(),
          sentAt: (docData.sentAt as { toDate?: () => Date } | null | undefined)?.toDate?.()?.toISOString() ?? null,
        };
      };

      const recentFailures: EmailFailure[] = failuresSnap.docs.map(mapDocToFailure);
      const recentAll: EmailFailure[] = recentAllSnap.docs.map(mapDocToFailure);

      setData({
        summary: {
          sent24h: totalSent,
          failed24h: totalFailed,
          failRate: (totalSent + totalFailed) === 0 ? 0 : totalFailed / (totalSent + totalFailed),
        },
        perTenant,
        recentFailures,
        recentAll,
      });
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, error, loading, updatedAt, refresh };
}
