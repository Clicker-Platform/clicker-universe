'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { ModuleDefinition } from '@/lib/modules/types';
import { QuickActionsHero } from '@/components/admin/dashboard/QuickActionsHero';
import { PagesGrid } from '@/components/admin/dashboard/PagesGrid';
import { ModuleCards } from '@/components/admin/dashboard/ModuleCards';
import { ModuleConnectionMap } from '@/components/admin/dashboard/ModuleConnectionMap';
import { DashboardSkeletonNew } from '@/components/skeletons/DashboardSkeletonNew';

export default function AdminDashboard() {
  const { siteId, tenantSlug, isSubdomain } = useSite();
  const [allModules, setAllModules] = useState<ModuleDefinition[]>([]);
  const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});
  const [businessName, setBusinessName] = useState('');
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
        setBusinessName(data.name ?? data.businessName ?? '');
      }
    });
    return () => unsub();
  }, [siteId]);

  const activeModules = useMemo<ModuleDefinition[]>(() =>
    allModules
      .filter(m => siteEnabledModules[m.id] === true)
      .map(m => ({ ...m, ...(STATIC_MODULE_DEFINITIONS[m.id] ?? {}) })),
    [allModules, siteEnabledModules]
  );

  if (loading) return <DashboardSkeletonNew />;

  return (
    <div>
      <QuickActionsHero
        businessName={businessName}
        activeModules={activeModules}
        baseUrl={baseUrl}
      />
      <PagesGrid baseUrl={baseUrl} />
      <ModuleCards
        activeModules={activeModules}
        siteId={siteId}
        baseUrl={baseUrl}
      />
      <ModuleConnectionMap activeModules={activeModules} />
    </div>
  );
}
