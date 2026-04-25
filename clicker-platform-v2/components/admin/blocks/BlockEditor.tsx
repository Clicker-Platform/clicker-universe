'use client';

import { PageBlock, BlockType } from '@/data/mockData';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Lock, Settings, ExternalLink } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { useSite } from '@/lib/site-context';

import { MODULE_COMPONENTS } from '@/lib/modules/components';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const FormSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
    </div>
);

// Dynamic Imports
const HeroForm = dynamic(() => import('./forms/HeroForm').then(mod => mod.HeroForm), { loading: () => <FormSkeleton /> });
const TextForm = dynamic(() => import('./forms/TextForm').then(mod => mod.TextForm), { loading: () => <FormSkeleton /> });
const ContentShowcaseForm = dynamic(() => import('./forms/ContentShowcaseForm').then(mod => mod.ContentShowcaseForm), { loading: () => <FormSkeleton /> });
const ImageForm = dynamic(() => import('./forms/ImageForm').then(mod => mod.ImageForm), { loading: () => <FormSkeleton /> });
const ButtonForm = dynamic(() => import('./forms/ButtonForm').then(mod => mod.ButtonForm), { loading: () => <FormSkeleton /> });
const ProductsForm = dynamic(() => import('./forms/ProductsForm').then(mod => mod.ProductsForm), { loading: () => <FormSkeleton /> });
const FAQForm = dynamic(() => import('./forms/FAQForm').then(mod => mod.FAQForm), { loading: () => <FormSkeleton /> });
const LinkBlockForm = dynamic(() => import('./forms/LinkBlockForm').then(mod => mod.LinkBlockForm), { loading: () => <FormSkeleton /> });
const MapForm = dynamic(() => import('./forms/MapForm').then(mod => mod.MapForm), { loading: () => <FormSkeleton /> });
const ImageGalleryBlockForm = dynamic(() => import('./forms/ImageGalleryBlockForm').then(mod => mod.ImageGalleryBlockForm), { loading: () => <FormSkeleton /> });

interface BlockEditorProps {
    block: PageBlock;
    onChange: (id: string, data: any) => void;
    onDelete: (id: string) => void;
}

export const BlockEditor = memo(({ block, onChange, onDelete }: BlockEditorProps) => {
    const { tenantSlug } = useSite();
    const [label, setLabel] = useState('Block');
    const [isExpanded, setIsExpanded] = useState(true);

    const [moduleInfo, setModuleInfo] = useState<{ name: string; description?: string; manageUrl?: string; componentKey?: string } | null>(null);

    // Subscribe to registry to get proper labels for module blocks
    useEffect(() => {
        // Quick lookup for core blocks
        const coreLabels: Record<string, string> = {
            'hero': 'Hero Section',
            'text': 'Text Content',
            'image': 'Image',
            'button': 'Button / CTA',
            'products': 'Product List',
            'faq': 'FAQ List',
            'link': 'Link Card',
            'map': 'Map Location',
            'image_gallery': 'Image Gallery'
        };

        if (coreLabels[block.type]) {
            setLabel(coreLabels[block.type]);
            setModuleInfo(null);
            return;
        }

        // For module blocks, check registry
        const unsubscribe = subscribeToEnabledModules((modules) => {
            let found = false;
            for (const mod of modules) {
                if (mod.blocks) {
                    const blockDef = mod.blocks.find(b => b.type === block.type);
                    if (blockDef) {
                        setLabel(blockDef.label);

                        // Smart Route Selection
                        let manageUrl = mod.adminRoutes && mod.adminRoutes.length > 0 ? mod.adminRoutes[0].path : undefined;

                        // 1. Prefer Settings/Configuration by default
                        const settingsRoute = mod.adminRoutes?.find(r =>
                            r.icon === 'settings' ||
                            r.label === 'Settings' ||
                            r.label === 'Configuration'
                        );
                        if (settingsRoute) manageUrl = settingsRoute.path;

                        // 2. Block-Specific Overrides (Contextual Deep Linking)
                        if (block.type === 'pos_menu_grid') {
                            const menuRoute = mod.adminRoutes?.find(r => r.path.includes('/menu') || r.componentKey?.includes('Menu'));
                            if (menuRoute) manageUrl = menuRoute.path;
                        }

                        setModuleInfo({
                            name: mod.displayName,
                            description: mod.description,
                            manageUrl: manageUrl,
                            componentKey: blockDef.componentKey // Capture componentKey
                        });
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                setLabel('Module Block (' + block.type + ')');
                setModuleInfo(null);
            }
        });

        return () => unsubscribe();
    }, [block.type]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleDataChange = (newData: any) => {
        onChange(block.id, newData);
    };

    const renderForm = () => {
        switch (block.type) {
            case 'hero': return <HeroForm data={block.data} onChange={handleDataChange} />;
            case 'text': return <TextForm data={block.data} onChange={handleDataChange} />;
            case 'content_showcase': return <ContentShowcaseForm data={block.data} onChange={handleDataChange} />;
            case 'image': return <ImageForm data={block.data} onChange={handleDataChange} />;
            case 'button': return <ButtonForm data={block.data} onChange={handleDataChange} />;
            case 'products': return <ProductsForm data={block.data} onChange={handleDataChange} />;
            case 'faq': return <FAQForm data={block.data} onChange={handleDataChange} />;
            case 'link': return <LinkBlockForm data={block.data} onChange={handleDataChange} />;
            case 'map': return <MapForm data={block.data} onChange={handleDataChange} />;
            case 'image_gallery': return <ImageGalleryBlockForm data={block.data} onChange={handleDataChange} />;
            default:
                if (moduleInfo) {
                    const ModuleComponent = moduleInfo.componentKey ? MODULE_COMPONENTS[moduleInfo.componentKey] : null;

                    return (
                        <div className="space-y-4">
                            {/* Configuration Header */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-dark">
                                        <Settings size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm">{moduleInfo.name}</h4>
                                        <p className="text-xs text-gray-500">Module is active</p>
                                    </div>
                                </div>
                                {moduleInfo.manageUrl && (
                                    <Link
                                        href={tenantSlug ? `/${tenantSlug}${moduleInfo.manageUrl}` : moduleInfo.manageUrl}
                                        target="_blank"
                                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-brand-dark hover:bg-gray-50 hover:border-brand-dark transition-colors"
                                    >
                                        <Settings size={12} />
                                        Configure
                                        <ExternalLink size={10} className="opacity-50" />
                                    </Link>
                                )}
                            </div>

                            {/* Live Preview */}
                            {ModuleComponent ? (
                                <div className="border-2 border-dashed border-gray-200 rounded-lg overflow-hidden min-h-[200px]">
                                    <div className="bg-gray-50 px-3 py-1 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">
                                        Live Preview
                                    </div>
                                    <div className="p-0 pointer-events-none opacity-100 relative">
                                        {/* Overlay to prevent interaction if needed, but scrolling might be desired. 
                                            For POS Widget, interaction is fine but might trigger cart? 
                                            Let's allow interaction but maybe disable 'Add' buttons via CSS if we could. 
                                            For now, just render it.
                                        */}
                                        <ModuleComponent />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    No preview available for this block.
                                </div>
                            )}
                        </div>
                    );
                }

                return (
                    <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-sm text-center">
                        This module block does not have any editable settings.
                    </div>
                );
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-white rounded-lg border-2 border-gray-100 overflow-hidden mb-4 transition-all hover:border-brand-dark/50">
            {/* Header / Drag Handle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div {...attributes} {...listeners} className="p-1.5 text-gray-400 hover:text-brand-dark hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing">
                        <GripVertical size={18} />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-wide text-gray-700">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-gray-500 hover:text-brand-dark hover:bg-gray-200 rounded">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button type="button" onClick={() => onDelete(block.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Form Content */}
            {isExpanded && (
                <div className="p-4">
                    {renderForm()}
                </div>
            )}
        </div>
    );
}, (prevProps: BlockEditorProps, nextProps: BlockEditorProps) => {
    // Custom comparison to ensure stability even if parent re-renders
    return (
        prevProps.block === nextProps.block && // Usually object reference is enough if immutable
        // But for safety in this specific dnd context + deep edits, we might trust ref
        prevProps.onChange === nextProps.onChange &&
        prevProps.onDelete === nextProps.onDelete
    );
});
