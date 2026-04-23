'use client';

/**
 * Safe write helpers for sites/{siteId}/content/siteSettings.
 *
 * Always uses { merge: true } — never overwrites unrelated fields.
 * Use these instead of calling setDoc/updateDoc directly on siteSettings.
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function writeSiteSettings(siteId: string, partial: Record<string, any>): Promise<void> {
    await setDoc(
        doc(db, 'sites', siteId, 'content', 'siteSettings'),
        partial,
        { merge: true },
    );
}
