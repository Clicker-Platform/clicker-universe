import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const cache = new Map<string, string>();

export async function lookupSiteNames(siteIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of siteIds) {
    if (cache.has(id)) {
      result[id] = cache.get(id)!;
    } else {
      missing.push(id);
    }
  }
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 30) {
    chunks.push(missing.slice(i, i + 30));
  }
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const q = query(collection(db, 'sites'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as { name?: string; businessName?: string };
      const name = data.name ?? data.businessName ?? null;
      if (name) {
        cache.set(d.id, name);
        result[d.id] = name;
      }
    });
  }
  return result;
}
