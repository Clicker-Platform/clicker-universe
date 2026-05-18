import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AppearanceStyles, DEFAULT_APPEARANCE_STYLES } from './types';

const STYLES_DOC = (siteId: string) => doc(db, 'sites', siteId, 'appearance', 'styles');

export async function getAppearanceStyles(siteId: string): Promise<AppearanceStyles> {
  const snap = await getDoc(STYLES_DOC(siteId));
  if (!snap.exists()) return { ...DEFAULT_APPEARANCE_STYLES };
  const data = snap.data() as Partial<AppearanceStyles>;
  return {
    fontPackId: data.fontPackId ?? null,
  };
}

export async function setFontPackId(siteId: string, packId: string | null): Promise<void> {
  await setDoc(
    STYLES_DOC(siteId),
    { fontPackId: packId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
