const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin (uses default credentials locally)
// Make sure to have GOOGLE_APPLICATION_CREDENTIALS set or be logged in via gcloud/firebase
try {
    admin.initializeApp({
        projectId: 'clicker-universe'
    });
} catch (e) {
    if (e.code !== 'app/already-exists') throw e;
}

const auth = getAuth();

const SUPERADMIN_EMAIL = process.argv[2] || 'admin@clicker.id';
const PASSWORD = process.argv[3] || 'password123'; // Default for dev, user should change

async function main() {
    console.log(`Checking user: ${SUPERADMIN_EMAIL}`);
    try {
        const user = await auth.getUserByEmail(SUPERADMIN_EMAIL);
        console.log(`User found: ${user.uid}`);
        console.log('Use this email to login.');
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            console.log('User not found. Creating...');
            const user = await auth.createUser({
                email: SUPERADMIN_EMAIL,
                password: PASSWORD,
                emailVerified: true,
            });
            console.log(`User created! UID: ${user.uid}`);
            console.log(`Email: ${SUPERADMIN_EMAIL}`);
            console.log(`Password: ${PASSWORD}`);
        } else {
            console.error('Error fetching user:', e);
            return;
        }
    }

    // Set Custom Claims
    console.log('Setting custom claims...');
    const user = await auth.getUserByEmail(SUPERADMIN_EMAIL);
    await auth.setCustomUserClaims(user.uid, { role: 'superadmin' });
    console.log(`✅ Success! User ${SUPERADMIN_EMAIL} is now a superadmin.`);
}

main().catch(console.error);
