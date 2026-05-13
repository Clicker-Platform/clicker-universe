import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ModuleCatalogEntry {
  id: string;
  name: string;
  description: string;
  defaultEnabled?: boolean;
}

let cache: ModuleCatalogEntry[] | null = null;

export async function fetchModulesCatalog(): Promise<ModuleCatalogEntry[]> {
  if (cache) return cache;

  const ref = doc(db, 'platformConfig', 'modules');
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('platformConfig/modules not found. Run seeder script.');
  }

  const data = snap.data();
  const catalog = (data?.catalog as ModuleCatalogEntry[]) ?? [];

  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('platformConfig/modules.catalog is empty or invalid.');
  }

  cache = catalog;
  return catalog;
}

export function clearCatalogCache(): void {
  cache = null;
}
