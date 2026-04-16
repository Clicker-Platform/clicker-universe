'use client';

import { useState, useEffect } from 'react';
import { ModuleDefinition, ModuleAccess } from '@/lib/modules/types';
import { SYSTEM_MODULES } from '@/lib/modules/definitions'; // Direct import in Backyard
import {
    ChevronDown, ChevronRight, Shield,
    CreditCard, MonitorDot, ClipboardList, Utensils, Settings,
    User, Box, Calendar, List, LayoutDashboard, Bot,
    FileText, BarChart3, Users, Trophy, Car, Wrench, Bell, Plus
} from 'lucide-react';

interface PermissionEditorProps {
    value: {
        permissions: string[];
        moduleAccess: Record<string, ModuleAccess>;
    };
    onChange: (val: { permissions: string[]; moduleAccess: Record<string, ModuleAccess> }) => void;
    siteModules: Record<string, boolean>; // Modules enabled for the tenant
}

const ICON_MAP: Record<string, any> = {
    'credit-card': CreditCard,
    'monitor-dot': MonitorDot,
    'clipboard-list': ClipboardList,
    'utensils': Utensils,
    'settings': Settings,
    'user': User,
    'users': Users,
    'box': Box,
    'calendar': Calendar,
    'list': List,
    'layout-dashboard': LayoutDashboard,
    'file-text': FileText,
    'bar-chart-3': BarChart3,
    'trophy': Trophy,
    'car': Car,
    'wrench': Wrench,
    'bell': Bell,
    'plus': Plus,
    'bot': Bot,
};

export function PermissionEditor({ value, onChange, siteModules }: PermissionEditorProps) {
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Filter SYSTEM_MODULES to show only those enabled for this site
        const active = SYSTEM_MODULES.filter(m => siteModules && siteModules[m.id]);
        setModules(active);

        // Auto expand all for visibility
        const initialExpanded: Record<string, boolean> = {};
        active.forEach(m => initialExpanded[m.id] = true);
        setExpandedModules(initialExpanded);
    }, [JSON.stringify(siteModules)]); // Re-run when siteModules changes

    const toggleModule = (moduleId: string, checked: boolean) => {
        const newPermissions = checked
            ? [...value.permissions, moduleId]
            : value.permissions.filter(p => p !== moduleId);

        const newModuleAccess = { ...value.moduleAccess };

        if (checked) {
            // Enable all routes as 'full' by default for convenience
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

    // Custom Categories for UI Grouping
    const CATEGORIES: Record<string, string[]> = {
        'Operations': ['byod_pos'],
        'Management': ['inventory', 'reservation', 'membership', 'sales_pipeline', 'service_records'],
        'AI & Sales': ['ai_sales'],
    };

    const groupedModules = modules.reduce((acc, module) => {
        const category = Object.keys(CATEGORIES).find(cat => CATEGORIES[cat].includes(module.id)) || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(module);
        return acc;
    }, {} as Record<string, ModuleDefinition[]>);

    const [activeCategory, setActiveCategory] = useState<string>('Operations');
    const sortedCategories = ['Operations', 'Management', 'AI & Sales', 'Other'].filter(c => groupedModules[c]?.length > 0);

    // Ensure active category exists
    useEffect(() => {
        if (!sortedCategories.includes(activeCategory) && sortedCategories.length > 0) {
            setActiveCategory(sortedCategories[0]);
        }
    }, [sortedCategories, activeCategory]);


    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 bg-gray-50 p-3 rounded-[20px] border border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Presets:</span>
                    <button type="button" onClick={() => applyPreset('cashier')} className="text-[10px] font-black uppercase bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-brand-dark hover:text-brand-dark transition-all active:scale-95">Cashier</button>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200">
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[10px] font-black uppercase text-brand-dark hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                        Select All
                    </button>
                    <div className="w-[1px] h-4 bg-gray-100" />
                    <button
                        type="button"
                        onClick={handleClearAll}
                        className="text-[10px] font-black uppercase text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Categories */}
            <div className="flex gap-2 bg-gray-100/30 p-1 rounded-lg border border-gray-100 shadow-inner mt-4">
                {sortedCategories.map(cat => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`flex-1 py-1.5 px-3 text-[9px] uppercase font-black rounded-lg transition-all duration-300 ${activeCategory === cat
                            ? 'bg-brand-dark text-white shadow-md transform scale-[1.02]'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid for Active Category */}
            <div className="mt-2">
                {sortedCategories.includes(activeCategory) && groupedModules[activeCategory] && (
                    <div className="grid grid-cols-1 gap-4">
                        {groupedModules[activeCategory].map(module => {
                            const accessMap = value.moduleAccess[module.id];
                            const isModuleEnabled = value.permissions.includes(module.id) || (!!accessMap && Object.values(accessMap).some(v => v !== 'none'));
                            const routes = module.adminRoutes?.filter(r => !r.hidden) || [];

                            // Resolve Icon
                            const iconName = module.adminRoutes?.[0]?.icon || 'box';
                            const Icon = ICON_MAP[iconName] || Box;

                            return (
                                <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden h-fit bg-white hover:border-brand-dark/20 transition-all group">
                                    {/* Module Header */}
                                    <div className="bg-gray-50/50 p-3.5 flex items-center justify-between border-b border-gray-100 group-hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200 text-gray-400 group-hover:text-brand-dark group-hover:border-brand-dark/30 transition-colors shrink-0">
                                                <Icon size={18} />
                                            </div>
                                            <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded border-gray-300 text-brand-dark focus:ring-brand-dark transition-all cursor-pointer"
                                                    checked={isModuleEnabled}
                                                    onChange={(e) => toggleModule(module.id, e.target.checked)}
                                                />
                                                <span className="font-black text-[15px] text-gray-800 tracking-tight">{module.displayName || module.id}</span>
                                            </label>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleExpanded(module.id)}
                                            className="text-gray-400 hover:text-gray-600 focus:outline-none bg-white p-1 rounded border border-gray-100"
                                        >
                                            {expandedModules[module.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                    </div>

                                    {/* Sub Routes */}
                                    {expandedModules[module.id] && (
                                        <div className="bg-white divide-y divide-gray-50 border-t border-gray-100">
                                            {routes.map(route => {
                                                const routeId = getRouteId(route.path);
                                                const accessLevel = value.moduleAccess[module.id]?.[routeId];

                                                // Resolve Route Icon
                                                const RouteIcon = route.icon ? (ICON_MAP[route.icon] || Box) : Box;

                                                return (
                                                    <div key={route.path} className="flex items-center justify-between group py-3.5 px-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors gap-4">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="p-2 rounded-lg bg-gray-50/80 text-gray-400 group-hover:text-brand-dark/70 transition-colors shrink-0">
                                                                <RouteIcon size={14} />
                                                            </div>
                                                            <span className="text-[13px] text-gray-600 font-bold group-hover:text-brand-dark transition-colors truncate">{route.label}</span>
                                                        </div>

                                                        {/* Access Level Selector */}
                                                        <div className="flex bg-gray-100/50 p-1 rounded-lg border border-gray-200/50 shadow-inner shrink-0">
                                                            {(['none', 'view', 'full'] as const).map((level) => {
                                                                const isSelected = accessLevel === level || (!accessLevel && level === 'none');
                                                                return (
                                                                    <button
                                                                        key={level}
                                                                        type="button"
                                                                        onClick={() => changeAccessLevel(module.id, routeId, level)}
                                                                        className={`
                                                                            px-3.5 py-1.5 text-[9px] uppercase font-black rounded-lg transition-all duration-300
                                                                            ${isSelected
                                                                                ? (level === 'none'
                                                                                    ? 'bg-white text-brand-dark shadow-md border border-gray-100 scale-105'
                                                                                    : level === 'view'
                                                                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                                                                        : 'bg-brand-dark text-white shadow-md scale-105')
                                                                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
                                                                            }                                                                  `}
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
                <div className="text-center py-12 text-gray-400">
                    <Shield size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No active modules found.</p>
                    <p className="text-sm mt-1">Enable modules in the tenant settings.</p>
                </div>
            )}
        </div>
    );
}
