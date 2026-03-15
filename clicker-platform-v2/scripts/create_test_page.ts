import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize firebase admin with standard application default credentials 
// or from environment since this project already has it.
// Actually, using the local firebase-admin directly might fail if it needs certs. 
// Let's just try initializing it with projectId.
admin.initializeApp({ projectId: 'clicker-universe' });

const db = admin.firestore();

async function run() {
    try {
        const sites = await db.collection('sites').limit(1).get();
        if (sites.empty) {
            console.log("No sites found!");
            return;
        }
        const siteId = sites.docs[0].id;
        console.log(`Using site: ${siteId}`);

        const pageRef = db.collection('sites').doc(siteId).collection('pages').doc('test-universal');
        await pageRef.set({
            title: "Universal Test Page",
            slug: "test-universal",
            published: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            blocks: [
                { id: "b1", type: "hero", data: { title: "Universal Hydration Test", subtitle: "If this works, system blocks are native too." } },
                { id: "b2", type: "quick_actions", data: {} },
                { id: "b3", type: "hours", data: {} },
                { id: "b4", type: "products", data: { title: "Our Products" } }
            ]
        });
        console.log(`Successfully created test-universal page at /${siteId}/test-universal`);
    } catch (e) {
        console.error(e);
    }
}

run();
