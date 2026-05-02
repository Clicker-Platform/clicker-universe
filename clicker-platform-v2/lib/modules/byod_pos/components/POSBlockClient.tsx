'use client';

import React, { useEffect, useState } from 'react';
import { getProducts } from '../api';
import { POSBlock } from './POSWidget';
import { Loader2 } from 'lucide-react';

import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

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
                logger.error('pos.block.items.load.failed', { siteId, error: err });
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
        />
    );
}
