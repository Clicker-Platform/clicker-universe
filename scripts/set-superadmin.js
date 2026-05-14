const admin = require('firebase-admin');

// 1. Initialize Firebase Admin
// Note: This script assumes you have 'serviceAccountKey.json' in this folder
// OR you are running in an environment with GOOGLE_APPLICATION_CREDENTIALS set.
// For local Mac usage with 'firebase login', you might try default credentials if fully set up,
// but usually Service Account is best for admin tasks.

// Try to use default credentials if serviceAccountKey.json is missing
try {
    var serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.log("No serviceAccountKey.json found, trying default Application Default Credentials...");
    admin.initializeApp({
        projectId: 'clicker-universe'
    });
}

const email = 'clickerplatform@gmail.com';

async function grantSuperAdmin() {
    try {
        console.log(`Looking up user ${email}...`);
        const user = await admin.auth().getUserByEmail(email);

        console.log('Found user', user.uid + '. Current claims:', user.customClaims);

        console.log('Granting superadmin role...');
        // Merge with existing claims if any, but ensure role is superadmin
        const currentClaims = user.customClaims || {};
        await admin.auth().setCustomUserClaims(user.uid, {
            ...currentClaims,
            role: 'superadmin'
        });

        console.log('✅ SUCCESS! User is now Superadmin.');
        console.log('NOTE: You may need to logout and login again for claims to refresh.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        console.error('If you get a credential error, allow the terminal to use Google Cloud SDK or download a Service Account Key.');
        process.exit(1);
    }
}

grantSuperAdmin();
