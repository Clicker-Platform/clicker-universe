const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Replace with the user's email if known, or list all users to find them
// For now, let's list users with 'admin' claim or related to 'kasisehat'
const TARGET_EMAIL = 'admin@kasisehat.com'; // CHANGE THIS if you know the real email
// If unknown, we can search by claim.

async function fixUserClaims() {
    console.log('🔍 Searching for users with broken siteId claims...');

    const listUsersResult = await admin.auth().listUsers(100);

    for (const user of listUsersResult.users) {
        const claims = user.customClaims || {};
        // Check if siteId is the old deleted one
        if (claims.siteId === 'kasisehat-bintaro') {
            console.log(`⚠️  Found user [${user.email}] with STALE siteId: ${claims.siteId}`);

            // Fix it -> change to 'kasisehat' (the new one)
            await admin.auth().setCustomUserClaims(user.uid, {
                ...claims,
                siteId: 'kasisehat' // UPDATE TO NEW ID
            });
            console.log(`✅ Updated user [${user.email}] siteId to 'kasisehat'.`);
            console.log(`ℹ️  User must LOGOUT and LOGIN again for changes to take effect.`);
        } else if (claims.siteId === 'kasisehat') {
            console.log(`✅ User [${user.email}] already has correct siteId: ${claims.siteId}`);
        }
    }

    console.log('🏁 Scan complete.');
}

fixUserClaims().catch(console.error);
