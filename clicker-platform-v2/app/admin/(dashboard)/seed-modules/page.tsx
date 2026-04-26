'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ModuleDefinition } from '@/lib/modules/types';
import { logger } from '@/lib/logger-edge';

export default function SeedModulesPage() {
    const [status, setStatus] = useState('Idle');

    const seed = async () => {
        setStatus('Seeding...');

        const testModule: ModuleDefinition = {
            id: 'reservation',
            displayName: 'Reservation',
            description: 'Booking system',
            icon: 'calendar',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                { path: '/admin/reservation', label: 'Bookings', icon: 'calendar', componentKey: 'reservation:Dashboard' },
                { path: '/admin/reservation/services', label: 'Services', icon: 'list', componentKey: 'reservation:AdminServices' },
                { path: '/admin/reservation/staff', label: 'Resources', icon: 'user', componentKey: 'reservation:AdminStaff', hidden: true },
                { path: '/admin/reservation/calendar', label: 'Calendar Settings', icon: 'calendar', componentKey: 'reservation:AdminBookings', hidden: true }
            ],
            publicRoutes: [
                { path: '/book', componentKey: 'reservation:BookPage' }
            ],
            blocks: [
                { type: 'reservation_cta', label: 'Reservation', componentKey: 'reservation:BookNowWaitlist' }
            ]
        };

        const inventoryModule: ModuleDefinition = {
            id: 'inventory',
            displayName: 'Inventory',
            description: 'Stock management',
            icon: 'box',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                { path: '/admin/inventory', label: 'Stock', icon: 'box', componentKey: 'inventory:AdminDashboard' }
            ]
        };

        const posModule: ModuleDefinition = {
            id: 'byod_pos',
            displayName: 'Self Order',
            description: 'BYOD POS System',
            icon: 'qr-code',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                { path: '/admin/pos/cashier', label: 'Cashier Station', icon: 'credit-card', componentKey: 'byod_pos:Cashier' },
                { path: '/admin/pos/kitchen', label: 'Kitchen Display', icon: 'monitor-dot', componentKey: 'byod_pos:KDS' },
                { path: '/admin/pos/history', label: 'Transactions', icon: 'clipboard-list', componentKey: 'byod_pos:Transactions' },
                { path: '/admin/pos/menu', label: 'Menu Manager', icon: 'utensils', componentKey: 'byod_pos:AdminMenu' },
                { path: '/admin/pos/settings', label: 'Configuration', icon: 'settings', componentKey: 'byod_pos:AdminSettings' }
            ],
            publicRoutes: [
                { path: '/order', componentKey: 'byod_pos:OrderPage' }
            ],
            requires: ['inventory'],
            blocks: [
                { type: 'pos_menu_grid', label: 'POS Menu', componentKey: 'byod_pos:MenuGrid' }
            ]
        };

        const membershipModule: ModuleDefinition = {
            id: 'membership',
            displayName: 'Membership & Loyalty',
            description: 'Customer loyalty program, points, and member management.',
            icon: 'user',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                {
                    path: '/admin/membership',
                    label: 'Members',
                    icon: 'user',
                    componentKey: 'membership:MemberListPage'
                },
                {
                    path: '/admin/membership/details',
                    label: 'Member Details',
                    hidden: true,
                    componentKey: 'membership:MemberDetailsPage'
                },
                {
                    path: '/admin/membership/settings',
                    label: 'Settings',
                    hidden: true,
                    componentKey: 'membership:Settings'
                }
            ],
            publicRoutes: [
                {
                    path: '/member/login',
                    componentKey: 'membership:LoginPage'
                }
            ],
            collections: ['modules/membership/members', 'modules/membership/transactions'],
            settings: {
                enableLoyalty: true,
                pointsName: 'Points',
                earningRatio: 1
            }
        };

        try {
            await setDoc(doc(db, 'modules', 'reservation'), testModule);
            await setDoc(doc(db, 'modules', 'inventory'), inventoryModule);
            await setDoc(doc(db, 'modules', 'byod_pos'), posModule);
            await setDoc(doc(db, 'modules', 'membership'), membershipModule);

            const salesPipelineModule: ModuleDefinition = {
                id: 'sales_pipeline',
                displayName: 'Sales Pipeline',
                description: 'CRM Kanban board for tracking leads through custom pipeline stages.',
                icon: 'trophy',
                version: '1.0.0',
                enabled: true,
                adminRoutes: [
                    { path: '/admin/sales-pipeline/board', label: 'Pipeline Board', icon: 'trophy', componentKey: 'sales_pipeline:PipelinePage' },
                    { path: '/admin/sales-pipeline/settings', label: 'Settings', icon: 'settings', componentKey: 'sales_pipeline:SettingsPage', permission: 'settings' }
                ],
                publicRoutes: [],
                collections: [
                    'modules/sales_pipeline/leads',
                    'modules/sales_pipeline/settings'
                ]
            };
            await setDoc(doc(db, 'modules', 'sales_pipeline'), salesPipelineModule);
            setStatus('Success: Modules seeded!');
        } catch (e: any) {
            logger.error('admin.modules.seed.failed', { siteId: 'platform', error: e });
            setStatus('Error: ' + e.message);
        }
    };

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Module Seeder</h1>
            <button
                onClick={seed}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
                Seed Modules
            </button>
            <p className="mt-4 font-mono">{status}</p>
        </div>
    );
}
