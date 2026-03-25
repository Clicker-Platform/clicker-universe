import { ComponentType } from 'react';
import dynamic from 'next/dynamic';

// Server Components: must be imported statically — dynamic() strips async/await capability
import BookPage from '@/lib/modules/reservation/public/BookPage';

// Dynamic Imports to avoid loading Admin/Server components in Client bundles or wrong contexts
const OrderPage = dynamic(() => import('@/lib/modules/byod_pos/public/OrderPage'));

// Admin Pages (POS) - USING CLIENT COMPONENTS DIRECTLY
// We point to Client libraries because MODULE_COMPONENTS is imported by SharedPageLayout (Client Context)
const POSOrdersPage = dynamic(() => import('@/lib/modules/byod_pos/admin/POSClient'));
const POSMenuPage = dynamic(() => import('@/lib/modules/byod_pos/admin/menu/POSMenuClient'));
const POSSettingsPage = dynamic(() => import('@/lib/modules/byod_pos/admin/SettingsPage'));
const KDSClient = dynamic(() => import('@/lib/modules/byod_pos/admin/KDSClient'));
const CashierClient = dynamic(() => import('@/lib/modules/byod_pos/admin/CashierClient'));
const TransactionsClient = dynamic(() => import('@/lib/modules/byod_pos/admin/TransactionsClient'));

// Admin Pages (Reservation) - USING CLIENT COMPONENTS DIRECTLY
const CalendarPage = dynamic(() => import('@/lib/modules/reservation/admin/calendar/CalendarClient'));
const ServicesPage = dynamic(() => import('@/lib/modules/reservation/admin/services/ServicesClient'));
const StaffPage = dynamic(() => import('@/lib/modules/reservation/admin/staff/StaffClient'));
const ReservationDashboard = dynamic(() => import('@/lib/modules/reservation/admin/page'));
const AdminBookingWizard = dynamic(() => import('@/lib/modules/reservation/admin/components/AdminBookingWizard'));
const ReservationSettingsPage = dynamic(() => import('@/lib/modules/reservation/admin/settings/ReservationSettingsPage'));

// Admin Pages (Inventory)
const InventoryAdminPage = dynamic(() => import('@/lib/modules/inventory/admin/InventoryAdminPage'));

// Admin Pages (Service Records)
const SR_RecordsListPage  = dynamic(() => import('@/lib/modules/service-records/admin/RecordsListPage'));
const SR_RecordFormPage   = dynamic(() => import('@/lib/modules/service-records/admin/RecordFormPage'));
const SR_RecordDetailPage = dynamic(() => import('@/lib/modules/service-records/admin/RecordDetailPage'));
const SR_VehiclesPage     = dynamic(() => import('@/lib/modules/service-records/admin/VehiclesPage'));
const SR_ServiceTypesPage = dynamic(() => import('@/lib/modules/service-records/admin/ServiceTypesPage'));
const SR_RemindersPage    = dynamic(() => import('@/lib/modules/service-records/admin/RemindersPage'));
const SR_SettingsPage     = dynamic(() => import('@/lib/modules/service-records/admin/SettingsPage'));
// Service Records — Member Dashboard Widgets
const SR_MemberWarrantyWidget = dynamic(() => import('@/lib/modules/service-records/public/MemberWarrantyWidget'));
const SR_MemberServiceHistoryWidget = dynamic(() => import('@/lib/modules/service-records/public/MemberServiceHistoryWidget'));

// Admin Pages (Membership)
const MemberListPage = dynamic(() => import('@/lib/modules/membership/admin/MemberListPage'));
const MemberDetailsPage = dynamic(() => import('@/lib/modules/membership/admin/MemberDetailsPage'));
const MembershipSettingsPage = dynamic(() => import('@/lib/modules/membership/admin/SettingsPage'));

// Module Block Components
const ReservationWidget = dynamic(() => import('@/lib/modules/reservation/public/ReservationWidget'));
const UpcomingReservationsWidget = dynamic(() => import('@/lib/modules/reservation/public/UpcomingReservationsWidget'));
// const POSBlockServer = dynamic(() => import('@/lib/modules/byod_pos/components/POSBlockServer'));

// Registry of all available module public components
// We use dynamic imports here so that Server Components work correctly where needed.

// 1. Universal / Server Components (Default)
// Use this for Server Pages (Admin, Public Site SSR)
export const MODULE_COMPONENTS: Record<string, any> = {
    // POS Module
    'byod_pos:OrderPage': OrderPage,
    'byod_pos:AdminOrders': POSOrdersPage,
    'byod_pos:AdminMenu': POSMenuPage,
    'byod_pos:AdminSettings': POSSettingsPage,
    'byod_pos:MenuGrid': dynamic(() => import('@/lib/modules/byod_pos/components/POSBlockClientLoader')),
    // Separated Views
    'byod_pos:KDS': KDSClient,
    'byod_pos:Cashier': CashierClient,
    'byod_pos:Transactions': TransactionsClient,

    // Reservation Module
    'reservation:BookPage': BookPage,
    'reservation:BookNowWaitlist': ReservationWidget, // Client component — rendered via ModuleBlockLoader in client tree
    'reservation:AdminBookings': CalendarPage,
    'reservation:AdminServices': ServicesPage,
    'reservation:ServiceList': ServicesPage,
    'reservation:AdminStaff': StaffPage,
    'reservation:Dashboard': ReservationDashboard,
    'reservation:AdminBookingWizard': AdminBookingWizard,
    'reservation:Settings': ReservationSettingsPage,
    'reservation:UpcomingWidget': UpcomingReservationsWidget,

    // Inventory Module
    'inventory:AdminDashboard': InventoryAdminPage,

    // Membership Module
    'membership:MemberListPage': MemberListPage,
    'membership:MemberDetailsPage': MemberDetailsPage,
    'membership:Settings': MembershipSettingsPage,
    'membership:LoginPage': dynamic(() => import('@/lib/modules/membership/components/public/LoginPage')),

    // Service Records Module
    'service_records:RecordsListPage':  SR_RecordsListPage,
    'service_records:RecordFormPage':   SR_RecordFormPage,
    'service_records:RecordDetailPage': SR_RecordDetailPage,
    'service_records:VehiclesPage':     SR_VehiclesPage,
    'service_records:ServiceTypesPage': SR_ServiceTypesPage,
    'service_records:RemindersPage':    SR_RemindersPage,
    'service_records:SettingsPage':     SR_SettingsPage,
    'service_records:MemberWarrantyWidget': SR_MemberWarrantyWidget,
    'service_records:MemberServiceHistoryWidget': SR_MemberServiceHistoryWidget,

    // AI Sales Agent Module
    'ai_sales:ChatWidget': dynamic(() => import('@/lib/modules/ai-sales-agent/components/ChatWidget')
        .then(mod => mod.ChatWidget)
    ),
    'ai_sales:AdminSettings': dynamic(() => import('@/lib/modules/ai-sales-agent/admin/AgentSettingsPage')),
    'ai_sales:Dashboard': dynamic(() => import('@/lib/modules/ai-sales-agent/admin/AgentDashboard')),
};
