'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, DocumentSnapshot, FirestoreError } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { Role } from '@/lib/rbac';

interface ModuleAccess {
    [routeId: string]: 'full' | 'view' | 'none'; // sub-route permissions
}

interface UserContextType {
    user: User | null;
    role: Role | null;
    permissions: string[];
    moduleAccess: Record<string, ModuleAccess>; // { "pos": { "cashier": "full" } }
    loading: boolean;
    isOwner: boolean;
    hasAccess: (moduleId: string, routeId: string) => boolean;
    getAccessLevel: (moduleId: string, routeId: string) => 'full' | 'view' | 'none';
    canEdit: (moduleId: string, routeId: string) => boolean;
}

const UserContext = createContext<UserContextType>({
    user: null,
    role: null,
    permissions: [],
    moduleAccess: {},
    loading: true,
    isOwner: false,
    hasAccess: () => false,
    getAccessLevel: () => 'none',
    canEdit: () => false,
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [moduleAccess, setModuleAccess] = useState<Record<string, ModuleAccess>>({});
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);

    const { siteId } = useSite();

    // Helper functions
    const getAccessLevel = (moduleId: string, routeId: string): 'full' | 'view' | 'none' => {
        if (loading) return 'none';
        if (isOwner) return 'full';

        // 1. Check Granular Permission (moduleAccess)
        // If the user has explicit setting for this module, RESPECT IT.
        // We must also handle aliases here (pos <-> byod_pos)
        let targetModuleId = moduleId;
        if (moduleAccess) {
            if (moduleAccess[moduleId]) {
                return moduleAccess[moduleId][routeId] || 'none';
            }
            // Alias logic
            if (moduleId === 'pos' && moduleAccess['byod_pos']) {
                return moduleAccess['byod_pos'][routeId] || 'none';
            }
            if (moduleId === 'byod_pos' && moduleAccess['pos']) {
                return moduleAccess['pos'][routeId] || 'none';
            }
        }

        // 2. Backward Compatibility: Old "permissions" array
        // Only check this if NO granular permissions exist for this module
        // Handle aliases: byod_pos <-> pos
        const checkPermission = (p: string) => {
            if (moduleId === 'byod_pos' && (p === 'pos' || p.startsWith('pos:'))) return true;
            if (moduleId === 'pos' && (p === 'byod_pos' || p.startsWith('byod_pos:'))) return true;
            return p === moduleId || p.startsWith(`${moduleId}:`);
        };

        if (permissions.includes('*') || permissions.some(checkPermission)) {
            return 'full';
        }

        return 'none';
    };

    const hasAccess = (moduleId: string, routeId: string): boolean => {
        const level = getAccessLevel(moduleId, routeId);
        return level === 'full' || level === 'view';
    };

    const canEdit = (moduleId: string, routeId: string): boolean => {
        return getAccessLevel(moduleId, routeId) === 'full';
    };

    useEffect(() => {
        if (!siteId || siteId === 'default' || siteId === 'pending') {
            setLoading(false);
            return;
        }

        // Subscription cleanup trackers
        let memberUnsubscribe: (() => void) | null = null;

        const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            // Cleanup previous member listener if user changes
            if (memberUnsubscribe) {
                memberUnsubscribe();
                memberUnsubscribe = null;
            }

            if (!currentUser) {
                setUser(null);
                setRole(null);
                setPermissions([]);
                setModuleAccess({});
                setIsOwner(false);
                setLoading(false);
                return;
            }

            setUser(currentUser);

            // 1. Setup Realtime Listener for Member Data
            // This ensures if Admin changes permissions, the User sees it IMMEDIATELY without refresh.
            const memberDocRef = doc(db, 'sites', siteId, 'members', currentUser.uid);

            memberUnsubscribe = onSnapshot(memberDocRef, async (memberSnap: DocumentSnapshot) => {
                if (memberSnap.exists()) {
                    const memberData = memberSnap.data();
                    if (!memberData) return; // Guard clause

                    // console.log('[UserContext] Realtime Update:', memberData.moduleAccess); // Debug
                    setRole(memberData.role as Role || 'staff');
                    setPermissions(memberData.permissions || []);
                    setModuleAccess(memberData.moduleAccess || {});
                    setIsOwner(memberData.role === 'owner');
                    setLoading(false);
                } else {
                    // 2. Fallback: Check if user is site owner via site metadata (One-time fetch is usually enough for owner)
                    try {
                        const siteDocRef = doc(db, 'sites', siteId);
                        const siteSnap = await getDoc(siteDocRef);

                        if (siteSnap.exists()) {
                            const siteData = siteSnap.data();
                            const ownerMatch =
                                siteData.ownerId === currentUser.uid ||
                                siteData.ownerEmail === currentUser.email;

                            if (ownerMatch) {
                                setRole('owner');
                                setPermissions(['*']); // Owner has full access
                                setIsOwner(true);
                                // ModuleAccess is implicit for Owner
                            } else {
                                // User is not a member or owner
                                setRole(null);
                                setPermissions([]);
                                setModuleAccess({});
                                setIsOwner(false);
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching site owner data:', err);
                    } finally {
                        setLoading(false);
                    }
                }
            }, (error: FirestoreError) => {
                console.error('[UserContext] Firestore listener error:', error);
                setLoading(false);
            });
        });

        return () => {
            authUnsubscribe();
            if (memberUnsubscribe) memberUnsubscribe();
        };
    }, [siteId]);

    return (
        <UserContext.Provider value={{
            user,
            role,
            permissions,
            moduleAccess,
            loading,
            isOwner,
            hasAccess,
            getAccessLevel,
            canEdit
        }}>
            {children}
        </UserContext.Provider>
    );
}
