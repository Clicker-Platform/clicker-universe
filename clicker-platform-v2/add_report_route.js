
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function addReportRoute() {
    const moduleId = 'byod_pos';
    const docRef = db.collection('modules').doc(moduleId);

    const doc = await docRef.get();
    if (!doc.exists) { console.error('Module not found'); return; }

    let routes = doc.data().adminRoutes || [];

    // Check if exists
    if (routes.find(r => r.path === '/admin/pos/reports')) {
        console.log('Report route already exists.');
        return;
    }

    const reportRoute = {
        path: '/admin/pos/reports',
        label: "Reports & Analytics",
        icon: "file-text",
        componentKey: "byod_pos:Reports"
    };

    routes.push(reportRoute);

    await docRef.update({ adminRoutes: routes });
    console.log('✅ Added Reports route to byod_pos module.');
}

addReportRoute();
