'use client';

import React, { useState, useEffect } from 'react';
import { findModuleForBlock } from '@/lib/modules/registry';
import { ModuleLoader } from './ModuleLoader';

interface ModuleBlockLoaderProps {
    type: string;
    data: any;
    siteId?: string;
}

export function ModuleBlockLoader({ type, data, siteId }: ModuleBlockLoaderProps) {
    const [componentKey, setComponentKey] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        findModuleForBlock(type).then(result => {
            setComponentKey(result ? result.componentKey : null);
        });
    }, [type]);

    // undefined = still loading, null = not found
    if (componentKey === undefined || componentKey === null) return null;

    return <ModuleLoader componentKey={componentKey} data={data} siteId={siteId} />;
}
