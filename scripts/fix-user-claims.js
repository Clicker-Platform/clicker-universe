const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

const UID = 'wPiDjuu4nBQKLpqJSVw55OGlRzl2'; // hi+1@clicker.id
const OLD_SITE_ID = 'hi-clicker';
const NEW_SITE_ID = 'demo';

async function migrateUser() {
    console.log(`🚀 Migrating user ${UID} from ${OLD_SITE_ID} to ${NEW_SITE_ID}...`);

    try {
        // 1. Get current user data from old site
        const oldUserRef = db.collection('sites').doc(OLD_SITE_ID).collection('members').doc(UID);
        const oldUserDoc = await oldUserRef.get();

        let userData = {};
        if (oldUserDoc.exists) {
            console.log(`Snapshot found in ${OLD_SITE_ID}. Copying data...`);
            userData = oldUserDoc.data();
        } else {
            console.log(`⚠️ User doc not found in ${OLD_SITE_ID}, fetching from Auth...`);
            const userRecord = await auth.getUser(UID);
            userData = {
                uid: UID,
                email: userRecord.email,
                displayName: userRecord.displayName || 'User',
                role: 'owner',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
        }

        // 2. Add to new site
        console.log(`Adding to ${NEW_SITE_ID}...`);
        await db.collection('sites').doc(NEW_SITE_ID).collection('members').doc(UID).set({
            ...userData,
            role: 'owner', // Ensure owner role
            movedFrom: OLD_SITE_ID,
            movedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 3. Update Custom Claims
        console.log(`Updating Custom Claims...`);
        await auth.setCustomUserClaims(UID, {
            siteId: NEW_SITE_ID,
            role: 'owner'
        });

        // 4. Remove from old site (Optional, maybe keep for backup but disable?)
        // Let's delete it to be clean as requested "seharusnya sudah ke demo"
        if (oldUserDoc.exists) {
            console.log(`Removing from ${OLD_SITE_ID}...`);
            await oldUserRef.delete();
        }

        console.log(`✅ Migration complete! User should now redirect to ${NEW_SITE_ID}.`);

    } catch (error) {
        console.error('❌ Error during migration:', error);
    }
}

migrateUser().catch(console.error);
