
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixReservationRoutes() {
    const moduleId = 'reservation';
    const docRef = db.collection('modules').doc(moduleId);

    // Define the desired routes based on the Sidebar HOTFIX
    // BUT we map them to the component keys we saw in the fetch
    // Sidebar Hotfix:
    // - Reservation (LayoutDashboard) -> /admin/reservation
    // - Calendar (Calendar) -> /admin/reservation/calendar 
    // - Services (List) -> /admin/reservation/services
    // - Staff / Resources (Users) -> /admin/reservation/staff

    // Current DB:
    // - /admin/reservation (key: Dashboard)
    // - /admin/reservation/services (key: AdminServices)
    // - /admin/reservation/staff (key: AdminStaff) [HIDDEN]
    // - /admin/reservation/calendar (key: AdminBookings) [HIDDEN]

    const newRoutes = [
        {
            path: '/admin/reservation',
            label: 'Bookings',
            icon: 'calendar', // Sidebar used LayoutDashboard, but calendar makes sense. Let's stick to DB or update? DB says 'calendar'. Let's keep DB preference unless user complains.
            componentKey: 'reservation:Dashboard'
        },
        {
            path: '/admin/reservation/calendar',
            label: 'Calendar Settings', // Sidebar said "Calendar". 
            icon: 'calendar',
            componentKey: 'reservation:AdminBookings'
            // REMOVED hidden: true
        },
        {
            path: '/admin/reservation/services',
            label: 'Services',
            icon: 'list',
            componentKey: 'reservation:AdminServices'
        },
        {
            path: '/admin/reservation/staff',
            label: 'Staff Resources', // Sidebar said "Staff / Resources"
            icon: 'user', // Sidebar used Users
            componentKey: 'reservation:AdminStaff'
            // REMOVED hidden: true
        }
    ];

    await docRef.update({ adminRoutes: newRoutes });
    console.log('✅ Updated reservation routes (removed hidden flags).');
}

fixReservationRoutes();
