'use client';

import React, { useEffect, useState } from 'react';
import { getProducts } from '../api';
import { POSBlock } from './POSWidget';
import { Loader2 } from 'lucide-react';

import { useSite } from '@/lib/site-context';

export default function POSBlockClient() {
    const { siteId } = useSite();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (siteId) {
            getProducts(siteId).then((data: any[]) => {
                setItems(data);
                setLoading(false);
            }).catch((err: any) => {
                console.error("Failed to load POS items", err);
                setLoading(false);
            });
        }
    }, [siteId]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <POSBlock
            initialItems={items}
            initialInventoryMap={{}} // Client side inventory sync via context or realtime usually
        />
    );
}
