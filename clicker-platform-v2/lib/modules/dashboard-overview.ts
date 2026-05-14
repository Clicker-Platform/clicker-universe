import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ModuleDefinition } from './types';

const DEFAULT_VISIBLE_COUNT = 3;

export function filterVisibleWidgets(
  storedIds: string[],
  enabledModules: ModuleDefinition[],
): string[] {
  const widgetCapable = new Set(
    enabledModules
      .filter(m => m.adminDashboardWidget?.componentKey)
      .map(m => m.id),
  );
  return storedIds.filter(id => widgetCapable.has(id));
}

export function defaultVisibleWidgets(enabledModules: ModuleDefinition[]): string[] {
  return enabledModules
    .filter(m => m.adminDashboardWidget?.componentKey)
    .slice(0, DEFAULT_VISIBLE_COUNT)
    .map(m => m.id);
}

export function subscribeToDashboardOverview(
  siteId: string,
  cb: (stored: string[] | null) => void,
): () => void {
  if (!siteId || siteId === 'default' || siteId === 'pending') {
    cb(null);
    return () => {};
  }
  return onSnapshot(doc(db, 'sites', siteId), snap => {
    const data = snap.data();
    const stored = data?.dashboardOverview?.visibleWidgets;
    cb(Array.isArray(stored) ? stored : null);
  });
}

export async function setVisibleWidgets(siteId: string, ids: string[]): Promise<void> {
  await setDoc(
    doc(db, 'sites', siteId),
    { dashboardOverview: { visibleWidgets: ids } },
    { merge: true },
  );
}
