import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { AppearanceStyles, DEFAULT_APPEARANCE_STYLES } from './types';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';

const STYLES_DOC = (siteId: string) => doc(db, 'sites', siteId, 'appearance', 'styles');

export async function getAppearanceStyles(siteId: string): Promise<AppearanceStyles> {
  const snap = await getDoc(STYLES_DOC(siteId));
  if (!snap.exists()) {
    return { ...DEFAULT_APPEARANCE_STYLES, buttonColors: { ...DEFAULT_BUTTON_COLORS } };
  }
  const data = snap.data() as Partial<AppearanceStyles>;
  return {
    fontPackId: data.fontPackId ?? null,
    buttonPackId: (data.buttonPackId as ButtonPackId | null | undefined) ?? null,
    buttonColors: { ...DEFAULT_BUTTON_COLORS, ...(data.buttonColors ?? {}) },
  };
}

export async function setFontPackId(siteId: string, packId: string | null): Promise<void> {
  await setDoc(
    STYLES_DOC(siteId),
    { fontPackId: packId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setButtonPackId(siteId: string, packId: ButtonPackId | null): Promise<void> {
  await setDoc(
    STYLES_DOC(siteId),
    { buttonPackId: packId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setButtonColors(siteId: string, patch: Partial<ButtonColors>): Promise<void> {
  const updates: Record<string, unknown> = {};
  // Iterate via Object.keys so we visit keys whose value is explicitly `undefined` —
  // those signal "delete this field" and must be translated to deleteField().
  // Object.entries would silently skip them.
  for (const k of Object.keys(patch) as Array<keyof ButtonColors>) {
    const v = patch[k];
    updates[`buttonColors.${k}`] = v === undefined ? deleteField() : v;
  }
  updates.updatedAt = serverTimestamp();
  await setDoc(STYLES_DOC(siteId), updates, { merge: true });
}
