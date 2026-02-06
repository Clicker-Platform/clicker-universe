import { ComponentType } from 'react';
import dynamic from 'next/dynamic';

// Dynamic Imports to avoid loading Admin/Server components in Client bundles or wrong contexts
const OrderPage = dynamic(() => import('@/lib/modules/byod_pos/public/OrderPage'));
const BookPage = dynamic(() => import('@/lib/modules/reservation/public/BookPage'));

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

// Admin Pages (Inventory)
const InventoryAdminPage = dynamic(() => import('@/lib/modules/inventory/admin/InventoryAdminPage'));

// Admin Pages (Membership)
const MemberListPage = dynamic(() => import('@/lib/modules/membership/admin/MemberListPage'));
const MemberDetailsPage = dynamic(() => import('@/lib/modules/membership/admin/MemberDetailsPage'));
const MembershipSettingsPage = dynamic(() => import('@/lib/modules/membership/admin/SettingsPage'));

// Module Block Components
const ReservationWidget = dynamic(() => import('@/lib/modules/reservation/public/ReservationWidget'));
const ReservationWidgetServer = dynamic(() => import('@/lib/modules/reservation/public/ReservationWidgetServer'));
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
    'reservation:BookNowWaitlist': ReservationWidget,
    'reservation:AdminBookings': CalendarPage,
    'reservation:AdminServices': ServicesPage,
    'reservation:AdminStaff': StaffPage,
    'reservation:Dashboard': ReservationDashboard,
    'reservation:UpcomingWidget': UpcomingReservationsWidget,

    // Inventory Module
    'inventory:AdminDashboard': InventoryAdminPage,

    // Membership Module
    'membership:MemberListPage': MemberListPage,
    'membership:MemberDetailsPage': MemberDetailsPage,
    'membership:Settings': MembershipSettingsPage,

    // AI Sales Agent Module
    'ai_sales:ChatWidget': dynamic(() => import('@/lib/modules/ai-sales-agent/components/ChatWidget')
        .then(mod => mod.ChatWidget)
    ),
    'ai_sales:AdminSettings': dynamic(() => import('@/lib/modules/ai-sales-agent/admin/AgentSettingsPage')),
    'ai_sales:Dashboard': dynamic(() => import('@/lib/modules/ai-sales-agent/admin/AgentDashboard')),
};
