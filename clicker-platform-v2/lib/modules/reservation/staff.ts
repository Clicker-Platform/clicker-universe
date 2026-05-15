import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Staff } from '@/lib/modules/reservation/types';

const STAFF_COLLECTION = 'modules/reservation/staff';

export async function getStaffMembers(siteId: string, onlyActive = false): Promise<Staff[]> {
    let q = query(collection(db, 'sites', siteId, STAFF_COLLECTION));

    if (onlyActive) {
        q = query(q, where('isActive', '==', true));
    }

    const snapshot = await getDocs(q);
    const staff = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            label: data.label || data.role || 'Staff'
        } as Staff;
    });

    // Sort in memory to avoid Firestore composite index requirement
    return staff.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createStaffMember(siteId: string, staff: Omit<Staff, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'sites', siteId, STAFF_COLLECTION), {
        ...staff,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

export async function updateStaffMember(siteId: string, id: string, updates: Partial<Omit<Staff, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = doc(db, 'sites', siteId, STAFF_COLLECTION, id);
    await updateDoc(docRef, updates);
}

export async function deleteStaffMember(siteId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, 'sites', siteId, STAFF_COLLECTION, id));
}
