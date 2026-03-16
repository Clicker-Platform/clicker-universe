'use client';

import { useState, useEffect } from 'react';
import { ModuleDefinition } from '@/lib/modules/types';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { Check, ChevronDown, ChevronRight, Shield } from 'lucide-react';

export interface ModuleAccess {
    [routeId: string]: 'full' | 'view' | 'none';
}

interface PermissionEditorProps {
    value: {
        permissions: string[];
        moduleAccess: Record<string, ModuleAccess>;
    };
    onChange: (val: { permissions: string[]; moduleAccess: Record<string, ModuleAccess> }) => void;
    siteModules: Record<string, boolean>;
}

export function PermissionEditor({ value, onChange, siteModules }: PermissionEditorProps) {
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const unsubscribe = subscribeToEnabledModules((fetched) => {
            // Filter only modules enabled for this site
            const active = fetched.filter(m => siteModules[m.id]);
            setModules(active);

            // Auto expand all for visibility
            const initialExpanded: Record<string, boolean> = {};
            active.forEach(m => initialExpanded[m.id] = true);
            setExpandedModules(initialExpanded);
        });
        return () => unsubscribe();
    }, [JSON.stringify(siteModules)]);

    const toggleModule = (moduleId: string, checked: boolean) => {
        const newPermissions = checked
            ? [...value.permissions, moduleId]
            : value.permissions.filter(p => p !== moduleId);

        const newModuleAccess = { ...value.moduleAccess };

        if (checked) {
            // Enable all routes by default? Or just the main one?
            // Let's enable all routes as 'full' by default for convenience
            const moduleDef = modules.find(m => m.id === moduleId);
            if (moduleDef?.adminRoutes) {
                const access: ModuleAccess = {};
                moduleDef.adminRoutes.filter(r => !r.hidden).forEach(r => {
                    const routeId = getRouteId(r.path);
                    access[routeId] = 'full';
                });
                newModuleAccess[moduleId] = access;
            }
        } else {
            delete newModuleAccess[moduleId];
        }

        onChange({
            permissions: newPermissions,
            moduleAccess: newModuleAccess
        });
    };

    const changeAccessLevel = (moduleId: string, routeId: string, level: 'full' | 'view' | 'none') => {
        const currentAccess = value.moduleAccess[moduleId] || {};
        const newAccess = { ...currentAccess };

        if (level === 'none') {
            // Explicitly set to 'none' instead of deleting, to ensure it overrides any existing 'view'/'full' 
            // during merge operations and prevents default fallback.
            newAccess[routeId] = 'none';
        } else {
            newAccess[routeId] = level;
        }

        const newModuleAccess = { ...value.moduleAccess, [moduleId]: newAccess };

        // Update permissions array based on if ANY route is active
        const hasAnyRoute = Object.keys(newAccess).length > 0;
        const newPermissions = hasAnyRoute
            ? Array.from(new Set([...value.permissions, moduleId]))
            : value.permissions.filter(p => p !== moduleId);

        onChange({
            permissions: newPermissions,
            moduleAccess: newModuleAccess
        });
    };

    const toggleExpanded = (moduleId: string) => {
        setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
    };

    const getRouteId = (path: string) => path.split('/').filter(Boolean).pop() || 'main';

    // UI Helpers
    const handleSelectAll = () => {
        const allPermissions: string[] = [];
        const allModuleAccess: Record<string, ModuleAccess> = {};

        modules.forEach(m => {
            allPermissions.push(m.id);
            if (m.adminRoutes) {
                const access: ModuleAccess = {};
                m.adminRoutes.filter(r => !r.hidden).forEach(r => {
                    const routeId = getRouteId(r.path);
                    access[routeId] = 'full';
                });
                allModuleAccess[m.id] = access;
            }
        });

        onChange({ permissions: allPermissions, moduleAccess: allModuleAccess });
    };

    const handleClearAll = () => {
        onChange({ permissions: [], moduleAccess: {} });
    };

    const applyPreset = (role: string) => {
        const newPerms: string[] = [];
        const newAccess: Record<string, ModuleAccess> = {};

        if (role === 'cashier') {
            const posId = modules.find(m => m.id === 'byod_pos')?.id;
            if (posId) {
                newPerms.push(posId);
                newAccess[posId] = { 'cashier': 'full', 'orders': 'full', 'menu_items': 'view' };
            }
        }

        onChange({ permissions: newPerms, moduleAccess: newAccess });
    };

    // Grouping Logic
    const CATEGORIES: Record<string, string[]> = {
        'Operations': ['byod_pos', 'kitchen-display', 'kiosk'],
        'Management': ['inventory', 'reservation', 'membership', 'sales-pipeline'],
        'Finance & Reports': ['finance'],
        'System': ['settings', 'developer', 'web-builder']
    };

    const groupedModules = modules.reduce((acc, module) => {
        const category = Object.keys(CATEGORIES).find(cat => CATEGORIES[cat].includes(module.id)) || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(module);
        return acc;
    }, {} as Record<string, ModuleDefinition[]>);

    const [activeCategory, setActiveCategory] = useState<string>('Operations');

    const sortedCategories = ['Operations', 'Management', 'Finance & Reports', 'System', 'Other'].filter(c => groupedModules[c]?.length > 0);

    // Ensure active category exists
    useEffect(() => {
        if (!sortedCategories.includes(activeCategory) && sortedCategories.length > 0) {
            setActiveCategory(sortedCategories[0]);
        }
    }, [sortedCategories, activeCategory]);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl border border-gray-100 dark:border-neutral-800">
                <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">Quick Presets:</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => applyPreset('cashier')} className="text-xs bg-white dark:bg-neutral-800 border border-dashed border-gray-300 dark:border-neutral-700 px-2.5 py-1.5 rounded-lg hover:border-brand-dark dark:hover:border-neutral-500 hover:text-brand-dark dark:hover:text-neutral-200 transition font-medium text-gray-700 dark:text-neutral-300">Cashier</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-xs font-bold text-brand-dark dark:text-neutral-400 hover:bg-white/50 dark:hover:bg-neutral-800 px-2 py-1 rounded transition"
                        >
                            Select All
                        </button>
                        <span className="text-gray-300 dark:text-neutral-700">|</span>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs font-bold text-red-500 hover:bg-white/50 dark:hover:bg-neutral-800 px-2 py-1 rounded transition"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-1 p-1 bg-gray-200/50 dark:bg-neutral-800/50 rounded-lg overflow-x-auto no-scrollbar">
                    {sortedCategories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat
                                ? 'bg-white dark:bg-neutral-700 text-brand-dark dark:text-neutral-100 shadow-sm'
                                : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 hover:bg-gray-200/50 dark:hover:bg-neutral-700/50'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid for Active Category */}
            <div className="min-h-[300px]">
                {sortedCategories.includes(activeCategory) && groupedModules[activeCategory] && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                        {groupedModules[activeCategory].map(module => {
                            const accessMap = value.moduleAccess[module.id];
                            const isModuleEnabled = value.permissions.includes(module.id) || (!!accessMap && Object.values(accessMap).some(v => v !== 'none'));
                            const routes = module.adminRoutes?.filter(r => !r.hidden) || [];

                            if (routes.length === 0) return null;

                            return (
                                <div key={module.id} className="border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden h-fit bg-white dark:bg-neutral-900 shadow-sm hover:border-brand-dark/20 dark:hover:border-neutral-700 transition-colors">
                                    {/* Module Header */}
                                    <div className="bg-gray-50/50 dark:bg-neutral-800/50 p-3 flex items-center justify-between border-b border-gray-100 dark:border-neutral-800">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpanded(module.id)}
                                                className="text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400 focus:outline-none"
                                            >
                                                {expandedModules[module.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </button>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 dark:border-neutral-700 text-brand-dark dark:text-neutral-400 focus:ring-brand-dark dark:focus:ring-neutral-700 dark:bg-neutral-800"
                                                    checked={isModuleEnabled}
                                                    onChange={(e) => toggleModule(module.id, e.target.checked)}
                                                />
                                                <span className="font-bold text-gray-800 dark:text-neutral-200">{module.displayName || module.id}</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Sub Routes */}
                                    {expandedModules[module.id] && (
                                        <div className="p-3 pl-11 space-y-2 bg-white dark:bg-neutral-900">
                                            {routes.map(route => {
                                                const routeId = getRouteId(route.path);
                                                const accessLevel = value.moduleAccess[module.id]?.[routeId];
                                                const isChecked = accessLevel === 'full' || accessLevel === 'view';

                                                return (
                                                    <div key={route.path} className="flex items-center justify-between group py-1">
                                                        <span className="text-sm text-gray-600 dark:text-neutral-400">{route.label}</span>

                                                        {/* Access Level Selector */}
                                                        <div className="flex bg-gray-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-gray-200 dark:border-neutral-700">
                                                            {(['none', 'view', 'full'] as const).map((level) => {
                                                                const isSelected = (level === 'none' && !value.moduleAccess[module.id]?.[routeId]) ||
                                                                    (value.moduleAccess[module.id]?.[routeId] === level);

                                                                return (
                                                                    <button
                                                                        key={level}
                                                                        type="button"
                                                                        onClick={() => changeAccessLevel(module.id, routeId, level)}
                                                                        className={`
                                                                            px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all
                                                                            ${isSelected
                                                                                ? (level === 'none' ? 'bg-white dark:bg-neutral-700 text-gray-400 dark:text-neutral-500 shadow-sm' :
                                                                                    level === 'view' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800' :
                                                                                        'bg-brand-dark dark:bg-neutral-600 text-white shadow-sm')
                                                                                : 'text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400 hover:bg-gray-200/50 dark:hover:bg-neutral-700/50'}
                                                                        `}
                                                                    >
                                                                        {level}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {modules.length === 0 && (
                <div className="text-center py-12 text-gray-400 dark:text-neutral-600">
                    <Shield size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No active modules found.</p>
                    <p className="text-sm mt-1">Enable modules in Site Settings first.</p>
                </div>
            )}
        </div>
    );
}
