'use client';

import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { logger } from '@/lib/logger';

export default function SeedPOSTest() {
    const [status, setStatus] = useState('Idle');

    const seed = async () => {
        setStatus('Seeding...');
        try {
            // 1. Create Product
            await setDoc(doc(db, 'products', 'pos-test-1'), {
                title: 'POS Test Item',
                price: 25000,
                description: 'A test item for POS flow',
                images: ['https://placehold.co/400'],
                categoryId: 'test-cat',
                createdAt: serverTimestamp()
            });

            // 2. Create Inventory Linked to it
            await setDoc(doc(db, 'inventory', 'inv-test-1'), {
                sku: 'TEST-POS-001',
                name: 'POS Test Item',
                currentStock: 10,
                lowStockThreshold: 2,
                unit: 'pcs',
                linkedProductId: 'pos-test-1',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setStatus('Success: TEst Data Created (Stock: 10)');
        } catch (e: any) {
            logger.error('pos.seed.data.failed', { siteId: 'platform', error: e });
            setStatus('Error: ' + e.message);
        }
    };

    const registerAdmin = async () => {
        setStatus('Registering Admin...');
        if (!auth.currentUser) {
            setStatus('Error: No User Signed In');
            return;
        }
        try {
            await setDoc(doc(db, 'modules/byod_pos/admins', auth.currentUser.uid), {
                role: 'admin',
                updatedAt: serverTimestamp()
            });
            setStatus('Success: Registered as Admin. Please refresh POS pages.');
        } catch (e: any) {
            logger.error('pos.admin.register.failed', { siteId: 'platform', error: e });
            setStatus('Error: ' + e.message);
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Seed POS Test Data</h1>
            <button onClick={seed} className="bg-blue-600 text-white px-4 py-2 rounded mr-4">
                Create Test Item (Stock: 10)
            </button>
            <button onClick={registerAdmin} className="bg-green-600 text-white px-4 py-2 rounded">
                Register Me as Admin
            </button>
            <pre className="mt-4 bg-gray-100 p-4">{status}</pre>
        </div>
    );
}
