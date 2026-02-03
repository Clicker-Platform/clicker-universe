import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Ensure Firebase Admin is initialized (Handled in index.ts)
// if (!admin.apps.length) {
//     admin.initializeApp();
// }

const MODULE_DEFINITIONS = [
    {
        id: 'membership',
        displayName: 'Membership & Loyalty',
        description: 'Customer loyalty program, points, and member management.',
        icon: 'user', // Maps to User icon
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            {
                path: '/admin/membership',
                label: 'Members',
                icon: 'user',
                componentKey: 'membership:MemberListPage'
            },
            {
                label: 'Member Details',
                hidden: true,
                componentKey: 'membership:MemberDetailsPage'
            },
            {
                path: '/admin/membership/settings',
                label: 'Settings',
                icon: 'settings',
                componentKey: 'membership:Settings'
            }
        ],
        publicRoutes: [
            {
                path: '/member/login',
                componentKey: 'membership:LoginPage'
            }
        ],
        collections: ['modules/membership/members', 'modules/membership/transactions'],
        settings: {
            enableLoyalty: true,
            pointsName: 'Points',
            earningRatio: 1
        }
    }
    // Add other modules here (reservation, pos, etc.) if needed in future
];

/**
 * Seeds the database with module definitions.
 * Accessible only by Superadmin.
 */
export const seedModules = functions.https.onCall(async (request) => {
    // 1. Security Check
    const SUPER_ADMIN_EMAIL = 'clickerplatform@gmail.com';
    if (!request.auth || (request.auth.token.role !== 'superadmin' && request.auth.token.email !== SUPER_ADMIN_EMAIL)) {
        throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can seed system modules.');
    }

    const db = admin.firestore();
    const batch = db.batch();

    try {
        for (const moduleDef of MODULE_DEFINITIONS) {
            const ref = db.collection('modules').doc(moduleDef.id);
            batch.set(ref, moduleDef, { merge: true });
        }

        await batch.commit();
        console.log(`✅ Successfully seeded ${MODULE_DEFINITIONS.length} modules.`);
        return { message: `Successfully seeded ${MODULE_DEFINITIONS.length} modules. System is ready.` };
    } catch (error: any) {
        console.error("❌ Error seeding modules:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
