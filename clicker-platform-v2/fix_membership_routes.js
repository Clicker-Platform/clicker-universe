
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixMembershipRoutes() {
    const moduleId = 'membership';
    const docRef = db.collection('modules').doc(moduleId);

    // Existing routes:
    // - /admin/membership
    // - /admin/membership/details (hidden)
    // - /admin/membership/settings (hidden) -> We want this VISIBLE

    const newRoutes = [
        {
            path: '/admin/membership',
            label: 'Members',
            icon: 'user',
            componentKey: 'membership:MemberListPage'
        },
        {
            path: '/admin/membership/details',
            label: 'Member Details',
            hidden: true, // Details page usually hidden from sidebar, accessed via click
            componentKey: 'membership:MemberDetailsPage'
        },
        {
            path: '/admin/membership/settings',
            label: 'Settings',
            icon: 'settings', // Added icon
            // hidden: true  <-- REMOVED
            componentKey: 'membership:Settings'
        }
    ];

    await docRef.update({ adminRoutes: newRoutes });
    console.log('✅ Updated membership routes (unhidden settings).');
}

fixMembershipRoutes();
