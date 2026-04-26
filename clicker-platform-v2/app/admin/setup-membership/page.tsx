
"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logger } from '@/lib/logger-edge';

const MODULE_DEF = {
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

export default function SetupMembershipPage() {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');

    async function handleRegister() {
        setStatus('registering');
        setError('');
        try {
            await setDoc(doc(db, 'modules', MODULE_DEF.id), MODULE_DEF);
            setStatus('success');
        } catch (err: any) {
            logger.error('membership.module.register.failed', { siteId: 'platform', error: err });
            setError(err.message);
            setStatus('error');
        }
    }

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Update Membership Module</h1>
            <p className="mb-6 text-gray-600">
                Click below to force-update the module definition in Firestore.
                This will fix the missing "Settings" route.
            </p>

            {status === 'success' && (
                <div className="bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400 p-4 rounded-lg mb-4">
                    ✅ Success! Access the <a href="/admin/membership/settings" className="underline font-bold">Settings Page</a> now.
                </div>
            )}

            {status === 'error' && (
                <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">
                    ❌ Error: {error}
                </div>
            )}

            <button
                onClick={handleRegister}
                disabled={status === 'registering'}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            >
                {status === 'registering' ? 'Updating...' : 'Update Module Definition'}
            </button>

            <pre className="mt-8 bg-gray-100 p-4 rounded overflow-auto text-xs max-h-96">
                {JSON.stringify(MODULE_DEF, null, 2)}
            </pre>
        </div>
    );
}
