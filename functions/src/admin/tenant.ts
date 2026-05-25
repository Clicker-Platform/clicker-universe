import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { performSiteSeeding } from './site';
import { seedModules } from "./modules/seeding";

// Firebase Admin is initialized in index.ts

/**
 * Creates a new Tenant (Site) document.
 * @param data { name: string, ownerEmail: string, subdomain: string }
 */
export const createTenant = functions.https.onCall(async (request) => {
    // 1. Security Check: Must be Superadmin
    if (!request.auth || request.auth.token.role !== 'superadmin') {
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
        if (!request.auth?.token.email || request.auth.token.email !== SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can create tenants.');
        }
    }

    const { name, ownerEmail, subdomain, hostingId, modules } = request.data;
    if (!name || !ownerEmail || !subdomain || !hostingId || !modules) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: name, ownerEmail, subdomain, hostingId, modules.');
    }

    const db = admin.firestore();
    const siteId = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '-');

    try {
        // 2. Check if site already exists
        const siteDoc = await db.collection('sites').doc(siteId).get();
        if (siteDoc.exists) {
            throw new functions.https.HttpsError('already-exists', `Site with ID ${siteId} already exists.`);
        }

        // 3. Create Site Document
        await db.collection('sites').doc(siteId).set({
            name,
            subdomain,
            ownerEmail,
            hostingId,
            createdAt: FieldValue.serverTimestamp(),
            status: 'active',
            slug: siteId, // Initialize with siteId as default slug
            modules: modules // No defaults - must be explicitly set from Backyard
        });

        // 3a. Create Slug Mapping
        await db.collection('slugMappings').doc(siteId).set({
            siteId: siteId,
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        // 3b. Initialize Settings with Slug
        await db.doc(`sites/${siteId}/settings/general`).set({
            slug: siteId,
            slugHistory: [],
            slugUpdatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // 4. Assign 'owner' role. Create user if not exists, update password if exists.
        const { password } = request.data;
        let userRecord;

        try {
            userRecord = await admin.auth().getUserByEmail(ownerEmail);
            // User exists — update password if provided so Backyard-set password takes effect
            if (password) {
                await admin.auth().updateUser(userRecord.uid, { password });
                console.log(`[createTenant] Updated password for existing user ${ownerEmail}`);
            }
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                if (password) {
                    console.log(`[createTenant] Creating new user for ${ownerEmail}`);
                    userRecord = await admin.auth().createUser({
                        email: ownerEmail,
                        password: password,
                        displayName: `Owner - ${name}`,
                        emailVerified: true
                    });
                } else {
                    console.warn(`User ${ownerEmail} not found and no password provided. Role not assigned.`);
                }
            } else {
                throw e;
            }
        }

        if (userRecord) {
            await admin.auth().setCustomUserClaims(userRecord.uid, {
                role: 'owner',
                siteId: siteId
            });

            // 4b. Set ownerId on the site document now that we have the UID
            await db.collection('sites').doc(siteId).update({
                ownerId: userRecord.uid,
            });

            // 4c. Create Member Document for Owner (idempotent)
            await db.collection('sites').doc(siteId).collection('members').doc(userRecord.uid).set({
                email: ownerEmail,
                role: 'owner',
                status: 'active',
                joinedAt: FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // 5. Automated Seed Data (Unified Logic)
        console.log(`[createTenant] Seeding initial data for ${siteId}...`);
        await performSiteSeeding(db, siteId, ownerEmail, { name, subdomain }); // Use normalized logic

        // Seed specific modules if enabled
        if (modules) {
            await seedModules(db, siteId, modules);
        }

        return { message: 'Tenant created successfully', siteId };
    } catch (error: any) {
        console.error("Error creating tenant:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});


/**
 * Suspends or Activates a Tenant.
 * @param data { siteId: string, status: 'active' | 'suspended' }
 */
export const suspendTenant = functions.https.onCall(async (request) => {
    if (!request.auth || request.auth.token.role !== 'superadmin') {
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
        if (request.auth?.token.email !== SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can manage tenants.');
        }
    }

    const { siteId, status } = request.data;
    if (!siteId || !['active', 'suspended'].includes(status)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid siteId or status.');
    }

    try {
        await admin.firestore().collection('sites').doc(siteId).update({
            status,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { message: `Tenant ${siteId} is now ${status}.` };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Lists all Tenants (Sites).
 * Bypasses Firestore Rules/App Check by using Admin SDK.
 * @returns { list: any[] }
 */
export const getTenants = functions.https.onCall(async (request) => {
    // 1. Security Check: Must be Superadmin
    if (!request.auth || request.auth.token.role !== 'superadmin') {
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
        if (!request.auth?.token.email || request.auth.token.email !== SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can view tenants.');
        }
    }

    try {
        // 2. Fetch all sites using Admin SDK
        const snapshot = await admin.firestore().collection('sites').get();
        const sites = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        return { list: sites };
    } catch (error: any) {
        console.error("Error fetching tenants:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Updates Modules for a Tenant.
 * (Reverted to V1 for Client SDK Compatibility)
 * @param data { siteId: string, modules: Record<string, boolean> }
 */
export const updateTenantModules = functions.https.onCall(async (request) => {
    // 1. Security Check: Must be Superadmin
    if (!request.auth || request.auth.token.role !== 'superadmin') {
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
        if (!request.auth?.token.email || request.auth.token.email !== SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can manage modules.');
        }
    }

    const { siteId, modules } = request.data;
    if (!siteId || !modules || typeof modules !== 'object') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid siteId or modules object.');
    }

    const db = admin.firestore();

    try {
        // 2. Verify site exists before updating
        const siteSnap = await db.collection('sites').doc(siteId).get();
        if (!siteSnap.exists) {
            throw new functions.https.HttpsError('not-found', `Site "${siteId}" does not exist. Please create the tenant first.`);
        }

        // 3. Update Modules Map (use update to avoid creating corrupt documents)
        await db.collection('sites').doc(siteId).update({
            modules: modules,
            updatedAt: FieldValue.serverTimestamp()
        });

        // 3. Trigger Lazy Seeding
        try {
            console.log(`[updateTenantModules] Seeding modules for ${siteId}...`);
            await seedModules(db, siteId, modules);
        } catch (seedError) {
            console.error("Error seeding modules:", seedError);
            // Don't fail the whole request, just log it.
        }

        return { message: `Modules updated for ${siteId}.`, modules };
    } catch (error: any) {
        console.error("Error updating modules:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
