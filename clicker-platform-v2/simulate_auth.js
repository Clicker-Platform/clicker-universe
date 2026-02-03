
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

// --- EXACT COPY OF LOGIC FROM UserContext.tsx (Adapted for JS) ---
function getAccessLevel(memberData, moduleId, routeId) {
    const isOwner = memberData.role === 'owner' || memberData.role === 'admin';
    const permissions = memberData.permissions || [];
    const moduleAccess = memberData.moduleAccess || {};

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
    const checkPermission = (p) => {
        if (moduleId === 'byod_pos' && (p === 'pos' || p.startsWith('pos:'))) return true;
        if (moduleId === 'pos' && (p === 'byod_pos' || p.startsWith('byod_pos:'))) return true;
        return p === moduleId || p.startsWith(`${moduleId}:`);
    };

    if (permissions.includes('*') || permissions.some(checkPermission)) {
        return 'full';
    }

    return 'none';
}
// -----------------------------------------------------------------

async function runSimulation() {
    const siteId = 'quattro';
    const email = 'staff+1@clicker.com';

    console.log(`\nSimulating Auth for ${email} on site ${siteId}...\n`);

    const membersRef = db.collection('sites').doc(siteId).collection('members');
    const snapshot = await membersRef.get();

    let memberData = null;
    snapshot.forEach(doc => {
        if (doc.data().email === email) {
            memberData = doc.data();
        }
    });

    if (!memberData) {
        console.error('Member not found!');
        return;
    }

    console.log('Member Data Loaded:');
    console.log('Role:', memberData.role);
    console.log('Permissions:', memberData.permissions);
    console.log('ModuleAccess:', JSON.stringify(memberData.moduleAccess, null, 2));

    console.log('\n--- TESTS ---\n');

    // Test Cases
    const tests = [
        { mod: 'byod_pos', route: 'settings', expect: 'none' }, // Config -> None
        { mod: 'byod_pos', route: 'kitchen', expect: 'full' },  // Config -> Full (based on prev check)
        { mod: 'byod_pos', route: 'cashier', expect: 'view' },  // Config -> View
        { mod: 'pos', route: 'settings', expect: 'none' },      // Alias Check
        { mod: 'inventory', route: 'main', expect: '???' },
    ];

    tests.forEach(t => {
        const result = getAccessLevel(memberData, t.mod, t.route);
        const pass = result === t.expect || t.expect === '???';
        console.log(`[${t.mod}:${t.route}] Result: ${result.toUpperCase()} \t Expect: ${t.expect.toUpperCase()} \t ${pass ? '✅' : '❌'}`);
    });
}

runSimulation();
