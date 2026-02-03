// 'use client';

import { MODULE_COMPONENTS } from '@/lib/modules/components';

interface ModuleLoaderProps {
    componentKey: string;
    [key: string]: any; // Allow passing through other props
}

export function ModuleLoader({ componentKey, ...props }: ModuleLoaderProps) {
    const Component = MODULE_COMPONENTS[componentKey];

    if (!Component) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-black text-gray-800 mb-2">Component Not Found</h2>
                    <p className="text-sm">The module component <code>{componentKey}</code> is not registered in the application.</p>
                </div>
            </div>
        );
    }

    return <Component {...props} />;
}
