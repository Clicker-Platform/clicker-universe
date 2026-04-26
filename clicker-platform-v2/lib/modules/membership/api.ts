import {
    collection,
    doc,
    getDocs,
    getDoc,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
    runTransaction,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    arrayUnion,
    arrayRemove,
    deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member, LoyaltyTransaction, MembershipSettings, MembershipStaffMember } from './types';
import { logger } from '@/lib/logger-edge';

// Collection References
export const MEMBERS_COLLECTION = 'modules/membership/members';
export const TRANSACTIONS_COLLECTION = 'modules/membership/transactions';
export const SETTINGS_DOC = 'modules/membership/settings/config';
export const COUNTER_DOC = 'modules/membership/settings/counter';

// --- Member Identity API ---

// Standardized Pagination (Matches byod_pos/api.ts)
export async function getPaginatedMembers(
    siteId: string,
    lastDoc: QueryDocumentSnapshot | null,
    pageSize: number = 20
): Promise<{ members: Member[], lastVisible: QueryDocumentSnapshot | null }> {
    let q = query(
        collection(db, 'sites', siteId, MEMBERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
    );

    if (lastDoc) {
        q = query(
            collection(db, 'sites', siteId, MEMBERS_COLLECTION),
            orderBy('createdAt', 'desc'),
            startAfter(lastDoc),
            limit(pageSize)
        );
    }

    const snapshot = await getDocs(q);
    const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

    return {
        members,
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };
}

// --- Member Identity API ---

// Helper: Normalize Phone Number (Default to local '08' format for consistency query)
// Standardizes inputs like: +6281..., 6281..., 081... into 081...
export function normalizePhoneNumber(phone: string): string {
    if (!phone) return '';

    // 1. Remove all non-numeric characters (spaces, dashes, parens, +)
    let cleaned = phone.replace(/\D/g, '');

    // 2. Normalize Country Code (ID)
    // If starts with 62, replace with 0
    if (cleaned.startsWith('62')) {
        cleaned = '0' + cleaned.slice(2);
    }

    return cleaned;
}

// --- Member Identity API ---

export async function findMemberByPhone(siteId: string, phoneNumber: string): Promise<Member | null> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const q = query(
        collection(db, 'sites', siteId, MEMBERS_COLLECTION),
        where('phoneNumber', '==', normalized),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Member;
}

export async function findMemberByEmail(siteId: string, email: string): Promise<Member | null> {
    const q = query(
        collection(db, 'sites', siteId, MEMBERS_COLLECTION),
        where('email', '==', email),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Member;
}

export async function findMemberByAuthId(siteId: string, uid: string): Promise<Member | null> {
    const q = query(
        collection(db, 'sites', siteId, MEMBERS_COLLECTION),
        where('uid', '==', uid),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Member;
}

export async function searchMembers(siteId: string, term: string): Promise<Member[]> {
    if (!term || term.length < 3) return [];

    const normalizedTerm = normalizePhoneNumber(term); // Try to normalize if it looks like phone
    const termIsPhone = /^\d+$/.test(term.replace('+', ''));

    const nameQuery = query(
        collection(db, 'sites', siteId, MEMBERS_COLLECTION),
        where('fullName', '>=', term),
        where('fullName', '<=', term + '\uf8ff'),
        limit(5)
    );

    const phoneQuery = query(
        collection(db, 'sites', siteId, MEMBERS_COLLECTION),
        where('phoneNumber', '>=', termIsPhone ? normalizedTerm : term),
        where('phoneNumber', '<=', (termIsPhone ? normalizedTerm : term) + '\uf8ff'),
        limit(5)
    );

    const [nameSnap, phoneSnap] = await Promise.all([
        getDocs(nameQuery),
        getDocs(phoneQuery)
    ]);

    const members = new Map<string, Member>();

    nameSnap.docs.forEach(doc => {
        const m = { id: doc.id, ...doc.data() } as Member;
        members.set(m.id, m);
    });

    phoneSnap.docs.forEach(doc => {
        const m = { id: doc.id, ...doc.data() } as Member;
        members.set(m.id, m);
    });

    return Array.from(members.values());
}

export async function createMember(
    siteId: string,
    data: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'currentPoints'>,
    memberCodePrefix?: string
): Promise<Member> {
    // Normalize phone before check/create
    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);

    // 1. Check if member already exists by Phone
    const existing = await findMemberByPhone(siteId, normalizedPhone);
    if (existing) {
        return existing;
    }

    // 2. Check by Email (Mandatory)
    if (!data.email) throw new Error('Email is required for membership.');

    const existingEmail = await findMemberByEmail(siteId, data.email);
    if (existingEmail) {
        return existingEmail;
    }

    // 3. Atomically assign member code + create member doc
    const prefix = (memberCodePrefix || 'MBR').toUpperCase().slice(0, 5);
    const counterRef = doc(db, 'sites', siteId, COUNTER_DOC);
    const newMemberRef = doc(collection(db, 'sites', siteId, MEMBERS_COLLECTION));
    let memberCode = '';

    await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const currentCount = counterSnap.exists() ? (counterSnap.data().memberCount || 0) : 0;
        const newCount = currentCount + 1;
        memberCode = `${prefix}-${String(newCount).padStart(3, '0')}`;

        transaction.set(newMemberRef, {
            ...data,
            phoneNumber: normalizedPhone,
            memberCode,
            currentPoints: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        transaction.set(counterRef, { memberCount: newCount }, { merge: true });
    });

    // 4. Return the new Member object (optimistic timestamp)
    return {
        id: newMemberRef.id,
        ...data,
        phoneNumber: normalizedPhone,
        memberCode,
        currentPoints: 0,
        totalSpent: 0,
        totalTransactions: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
}

export async function updateMemberAuth(siteId: string, memberId: string, uid: string, email: string): Promise<void> {
    const docRef = doc(db, 'sites', siteId, MEMBERS_COLLECTION, memberId);
    await updateDoc(docRef, {
        uid,
        email,
        updatedAt: serverTimestamp()
    });
}

export async function updateMemberProfile(
    siteId: string,
    memberId: string,
    data: { fullName: string; phoneNumber: string; email: string }
): Promise<void> {
    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
    const docRef = doc(db, 'sites', siteId, MEMBERS_COLLECTION, memberId);

    // Check for duplicates (optional but good practice) - skipped for MVP speed, reliant on Firestore rules or admin trust
    // In a real strict app, we should check if new phone/email is taken by ANOTHER member.

    await updateDoc(docRef, {
        fullName: data.fullName,
        phoneNumber: normalizedPhone,
        email: data.email,
        updatedAt: serverTimestamp()
    });
}

// --- Loyalty API (Public Contract) ---

export async function awardPoints(
    siteId: string,
    memberId: string,
    amount: number,
    source: string,
    sourceRefId: string,
    description?: string
): Promise<void> {
    // 1. Check if Loyalty is enabled
    const settings = await getMembershipSettings(siteId);
    if (!settings.enableLoyalty) return;

    if (amount === 0) return;

    // 2. Run Transaction to ensure consistency
    await runTransaction(db, async (transaction) => {
        const memberRef = doc(db, 'sites', siteId, MEMBERS_COLLECTION, memberId);
        const memberSnap = await transaction.get(memberRef);

        if (!memberSnap.exists()) throw new Error("Member does not exist.");

        const currentPoints = memberSnap.data().currentPoints || 0;
        const newPoints = currentPoints + amount;

        // A. Update Member
        transaction.update(memberRef, {
            currentPoints: newPoints,
            updatedAt: serverTimestamp()
        });

        // B. Create Transaction Record
        const transRef = doc(collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION));
        const record: Omit<LoyaltyTransaction, 'id'> = {
            memberId,
            source,
            sourceRefId,
            pointsDelta: amount,
            description: description || `Points adjustment from ${source}`,
            createdAt: Timestamp.now()
        };
        transaction.set(transRef, record);
    });
}
// V2 with Spend Tracking
// V2 with Spend Tracking
export async function awardPointsWithSpend(
    siteId: string,
    memberId: string,
    points: number,
    spendAmount: number,
    source: string,
    sourceRefId: string,
    description?: string
): Promise<void> {
    const settings = await getMembershipSettings(siteId);
    if (!settings.enableLoyalty) return;

    await runTransaction(db, async (transaction) => {
        const memberRef = doc(db, 'sites', siteId, MEMBERS_COLLECTION, memberId);
        const memberSnap = await transaction.get(memberRef);
        if (!memberSnap.exists()) throw new Error("Member does not exist.");

        const data = memberSnap.data();
        const currentPoints = data.currentPoints || 0;
        const currentSpent = data.totalSpent || 0;
        const currentTxCount = data.totalTransactions || 0;

        transaction.update(memberRef, {
            currentPoints: currentPoints + points,
            totalSpent: currentSpent + (spendAmount || 0),
            totalTransactions: currentTxCount + 1,
            updatedAt: serverTimestamp()
        });

        const transRef = doc(collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION));
        transaction.set(transRef, {
            memberId,
            source,
            sourceRefId,
            pointsDelta: points,
            spendAmount: spendAmount || 0,
            description: description || `Points adjustment from ${source}`,
            createdAt: Timestamp.now()
        });
    });
}

export async function getMemberHistory(siteId: string, memberId: string, pageSize = 30): Promise<LoyaltyTransaction[]> {
    const q = query(
        collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION),
        where('memberId', '==', memberId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoyaltyTransaction));
}

// --- Settings API ---

export async function getMembershipSettings(siteId: string): Promise<MembershipSettings> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as MembershipSettings;
    }
    // Defaults
    return {
        enableLoyalty: true,
        pointsName: 'Points',
        earningRatio: 1
    };
}

export async function backfillMemberCodes(
    siteId: string,
    prefix: string,
    onProgress?: (done: number, total: number) => void
): Promise<{ backfilled: number; skipped: number }> {
    const membersRef = collection(db, 'sites', siteId, MEMBERS_COLLECTION);
    const snapshot = await getDocs(query(membersRef, orderBy('createdAt', 'asc')));

    const toBackfill = snapshot.docs.filter(d => !d.data().memberCode);
    const total = toBackfill.length;

    if (total === 0) return { backfilled: 0, skipped: snapshot.docs.length };

    const cleanPrefix = prefix.toUpperCase().slice(0, 5) || 'MBR';
    const counterRef = doc(db, 'sites', siteId, COUNTER_DOC);
    const counterSnap = await getDoc(counterRef);
    let counter = counterSnap.exists() ? (counterSnap.data().memberCount || 0) : 0;

    let done = 0;
    for (const memberDoc of toBackfill) {
        counter++;
        const memberCode = `${cleanPrefix}-${String(counter).padStart(3, '0')}`;
        await updateDoc(memberDoc.ref, { memberCode });
        done++;
        onProgress?.(done, total);
    }

    await setDoc(counterRef, { memberCount: counter }, { merge: true });

    return { backfilled: total, skipped: snapshot.docs.length - total };
}

export async function updateMembershipSettings(siteId: string, settings: Partial<MembershipSettings>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/**
 * Membership Staff / Permissions API
 */

export async function getMembershipStaff(siteId: string): Promise<MembershipStaffMember[]> {
    const membersRef = collection(db, 'sites', siteId, 'members');
    // Query for permissions OR role
    const qPermissions = query(membersRef, where('permissions', 'array-contains', 'membership'));

    // As with POS, we generally assume owners have access, but strictly speaking "permissions" array should handle it.
    // However, legacy "owner" role often bypasses explicit arrays. Let's merge both.
    const qOwner = query(membersRef, where('role', '==', 'owner'));

    const [snapPerms, snapOwner] = await Promise.all([getDocs(qPermissions), getDocs(qOwner)]);

    const staffMap = new Map<string, MembershipStaffMember>();

    const processDoc = (docSnap: any, defaultRole: string = 'staff') => {
        const data = docSnap.data();
        if (!staffMap.has(docSnap.id)) {
            staffMap.set(docSnap.id, {
                userId: docSnap.id,
                email: data.email || '',
                name: data.displayName || data.name || 'Unknown',
                role: data.role === 'owner' ? 'manager' : defaultRole,
                assignedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt)) : new Date()
            });
        }
    };

    snapPerms.docs.forEach(d => processDoc(d));
    snapOwner.docs.forEach(d => processDoc(d, 'manager'));

    return Array.from(staffMap.values());
}

/**
 * @deprecated Use Global Team Management (/admin/settings/team)
 */
export async function assignMembershipRole(siteId: string, email: string, role: string): Promise<void> {
    logger.warn('membership.role.deprecated', { siteId });
}

/**
 * @deprecated Use Global Team Management (/admin/settings/team)
 */
export async function removeMembershipRole(siteId: string, userId: string): Promise<void> {
    logger.warn('membership.role.deprecated', { siteId });
}

export async function getMembershipRole(siteId: string, userId: string): Promise<string | null> {
    const memberRef = doc(db, 'sites', siteId, 'members', userId);
    const snap = await getDoc(memberRef);
    if (snap.exists()) {
        const data = snap.data();
        if (data.role === 'owner') return 'manager';
        if (data.permissions?.includes('membership')) return 'staff';
        if (data.moduleAccess?.membership) return 'staff';
    }
    return null;
}
