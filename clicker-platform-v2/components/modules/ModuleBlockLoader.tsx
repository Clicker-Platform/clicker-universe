import React from 'react';
import { findModuleForBlock } from '@/lib/modules/registry';
import { ModuleLoader } from './ModuleLoader';

interface ModuleBlockLoaderProps {
    type: string;
    data: any;
    siteId?: string;
}

export async function ModuleBlockLoader({ type, data, siteId }: ModuleBlockLoaderProps) {
    // 1. Resolve the module that owns this block type
    // This function checks ENABLED modules only.
    const result = await findModuleForBlock(type);

    if (!result) {
        // Module not found or disabled, or block type not registered
        return null;
    }

    // 2. Render the component using the generic ModuleLoader
    return <ModuleLoader componentKey={result.componentKey} data={data} siteId={siteId} />;
}
