'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import type { ModuleDefinition } from '@/lib/modules/types';
import {
  subscribeToDashboardOverview,
  filterVisibleWidgets,
  defaultVisibleWidgets,
} from '@/lib/modules/dashboard-overview';
import { OverviewLayout } from '@/components/admin/dashboard/OverviewLayout';
import { InboxColumn } from '@/components/admin/dashboard/InboxColumn';
import { PagesColumn } from '@/components/admin/dashboard/PagesColumn';
import { ModulesColumn } from '@/components/admin/dashboard/ModulesColumn';
import { DashboardSkeletonNew } from '@/components/skeletons/DashboardSkeletonNew';

export default function AdminDashboard() {
  const { siteId, tenantSlug, isSubdomain } = useSite();
  const [allModules, setAllModules] = useState<ModuleDefinition[]>([]);
  const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});
  const [storedVisible, setStoredVisible] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUrl = tenantSlug && !isSubdomain ? `/${tenantSlug}` : '';

  useEffect(() => {
    const unsub = subscribeToEnabledModules(fetched => {
      setAllModules(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const unsub = onSnapshot(doc(db, 'sites', siteId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        const legacy = data.settings?.modules ?? {};
        const root = data.modules ?? {};
        setSiteEnabledModules({ ...legacy, ...root });
      }
    });
    return () => unsub();
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    return subscribeToDashboardOverview(siteId, setStoredVisible);
  }, [siteId]);

  const enabledModules = useMemo<ModuleDefinition[]>(
    () =>
      allModules
        .filter(m => siteEnabledModules[m.id] === true)
        .map(m => ({ ...m, ...(STATIC_MODULE_DEFINITIONS[m.id] ?? {}) })),
    [allModules, siteEnabledModules],
  );

  const visibleIds = useMemo(() => {
    if (storedVisible === null) return defaultVisibleWidgets(enabledModules);
    return filterVisibleWidgets(storedVisible, enabledModules);
  }, [storedVisible, enabledModules]);

  if (loading) return <DashboardSkeletonNew />;

  return (
    <OverviewLayout
      inbox={<InboxColumn siteId={siteId} />}
      pages={<PagesColumn siteId={siteId} baseUrl={baseUrl} />}
      modules={
        <ModulesColumn
          siteId={siteId}
          baseUrl={baseUrl}
          enabledModules={enabledModules}
          visibleIds={visibleIds}
        />
      }
    />
  );
}
