import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
    runTransaction,
    limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member, LoyaltyTransaction, MembershipSettings } from './types';

// Collection References
// Collection Suffixes
export const MEMBERS_COLLECTION = 'modules/membership/members';
export const TRANSACTIONS_COLLECTION = 'modules/membership/transactions';
export const SETTINGS_DOC = 'modules/membership/settings/config';

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
        where('name', '>=', term),
        where('name', '<=', term + '\uf8ff'),
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

export async function createMember(siteId: string, data: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'currentPoints'>): Promise<Member> {
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

    // 3. Create New Member
    const docRef = await addDoc(collection(db, 'sites', siteId, MEMBERS_COLLECTION), {
        ...data,
        phoneNumber: normalizedPhone, // Explicit override
        currentPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // 4. Return the new Member object (optimistic timestamp)
    return {
        id: docRef.id,
        ...data,
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

export async function getMemberHistory(siteId: string, memberId: string): Promise<LoyaltyTransaction[]> {
    const q = query(
        collection(db, 'sites', siteId, TRANSACTIONS_COLLECTION),
        where('memberId', '==', memberId),
        orderBy('createdAt', 'desc')
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

export async function updateMembershipSettings(siteId: string, settings: Partial<MembershipSettings>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, SETTINGS_DOC);
    await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp()
    }, { merge: true });
}
