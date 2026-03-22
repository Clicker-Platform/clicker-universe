'use client';

import { PageBlock, BlockType } from '@/data/mockData';
import { useState, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import { Settings, ExternalLink, Box } from 'lucide-react';
import Link from 'next/link';
import { getTemplate } from '@/lib/templates/registry';
import { LayoutVariantPicker } from './forms/LayoutVariantPicker';

const FormSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
        <div className="h-10 bg-neutral-800 rounded"></div>
        <div className="h-32 bg-neutral-800 rounded"></div>
    </div>
);

// Dynamic Imports
const HeroForm = dynamic(() => import('./forms/HeroForm').then(mod => mod.HeroForm), { loading: () => <FormSkeleton /> });
const TextForm = dynamic(() => import('./forms/TextForm').then(mod => mod.TextForm), { loading: () => <FormSkeleton /> });
const ImageForm = dynamic(() => import('./forms/ImageForm').then(mod => mod.ImageForm), { loading: () => <FormSkeleton /> });
const ButtonForm = dynamic(() => import('./forms/ButtonForm').then(mod => mod.ButtonForm), { loading: () => <FormSkeleton /> });
const ProductsForm = dynamic(() => import('./forms/ProductsForm').then(mod => mod.ProductsForm), { loading: () => <FormSkeleton /> });
const FAQForm = dynamic(() => import('./forms/FAQForm').then(mod => mod.FAQForm), { loading: () => <FormSkeleton /> });
const LinkBlockForm = dynamic(() => import('./forms/LinkBlockForm').then(mod => mod.LinkBlockForm), { loading: () => <FormSkeleton /> });
const MapForm = dynamic(() => import('./forms/MapForm').then(mod => mod.MapForm), { loading: () => <FormSkeleton /> });
const ImageGalleryBlockForm = dynamic(() => import('./forms/ImageGalleryBlockForm').then(mod => mod.ImageGalleryBlockForm), { loading: () => <FormSkeleton /> });
const SystemBlockForm = dynamic(() => import('./forms/SystemBlockForm').then(mod => mod.SystemBlockForm), { loading: () => <FormSkeleton /> });
const QuickActionsBlockForm = dynamic(() => import('./forms/QuickActionsBlockForm').then(mod => mod.QuickActionsBlockForm), { loading: () => <FormSkeleton /> });

interface BlockFormRendererProps {
    block: PageBlock;
    onChange: (id: string, data: any) => void;
    templateId?: string;
}

export const BlockFormRenderer = memo(({ block, onChange, templateId = 'classic' }: BlockFormRendererProps) => {
    const [moduleInfo, setModuleInfo] = useState<{ name: string; description?: string; manageUrl?: string; componentKey?: string } | null>(null);

    // Subscribe to registry for module info
    useEffect(() => {
        // Quick lookup for core blocks
        const coreLabels: Record<string, string> = {
            'hero': 'Hero', 'text': 'Text', 'image': 'Image', 'button': 'Button',
            'products': 'Products', 'faq': 'FAQ', 'link': 'Link', 'map': 'Map', 'image_gallery': 'Gallery',
            'quick_actions': 'Quick Actions', 'hours': 'Operating Hours', 'featured_product': 'Featured Product', 'branches': 'Branches'
        };

        if (coreLabels[block.type]) {
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
                        let manageUrl = mod.adminRoutes && mod.adminRoutes.length > 0 ? mod.adminRoutes[0].path : undefined;
                        const settingsRoute = mod.adminRoutes?.find(r => r.icon === 'settings' || r.label === 'Settings' || r.label === 'Configuration');
                        if (settingsRoute) manageUrl = settingsRoute.path;

                        if (block.type === 'pos_menu_grid') {
                            const menuRoute = mod.adminRoutes?.find(r => r.path.includes('/menu') || r.componentKey?.includes('Menu'));
                            if (menuRoute) manageUrl = menuRoute.path;
                        }

                        setModuleInfo({
                            name: mod.displayName,
                            description: mod.description,
                            manageUrl: manageUrl,
                            componentKey: blockDef.componentKey
                        });
                        found = true;
                        break;
                    }
                }
            }
            if (!found) setModuleInfo(null);
        });
        return () => unsubscribe();
    }, [block.type]);

    const handleDataChange = (newData: any) => {
        onChange(block.id, newData);
    };

    const handleVariantChange = (newVariant: string) => {
        onChange(block.id, { ...block.data, layoutVariant: newVariant });
    };

    const template = getTemplate(templateId);
    const defaultVariant = template.config.defaultBlockLayouts?.[block.type] || 'default';
    const currentVariant = block.data.layoutVariant || defaultVariant;

    const renderWithLayoutPicker = (FormContent: React.ReactNode) => (
        <div className="space-y-6">
            <LayoutVariantPicker 
                blockType={block.type as BlockType} 
                currentVariant={currentVariant}
                templateDefault={defaultVariant}
                onChange={handleVariantChange} 
            />
            {FormContent}
        </div>
    );

    switch (block.type) {
        case 'hero': return renderWithLayoutPicker(<HeroForm data={block.data} onChange={handleDataChange} />);
        case 'text': return renderWithLayoutPicker(<TextForm data={block.data} onChange={handleDataChange} />);
        case 'image': return renderWithLayoutPicker(<ImageForm data={block.data} onChange={handleDataChange} />);
        case 'button': return renderWithLayoutPicker(<ButtonForm data={block.data} onChange={handleDataChange} />);
        case 'products': return renderWithLayoutPicker(<ProductsForm data={block.data} onChange={handleDataChange} />);
        case 'faq': return renderWithLayoutPicker(<FAQForm data={block.data} onChange={handleDataChange} />);
        case 'link': return renderWithLayoutPicker(<LinkBlockForm data={block.data} onChange={handleDataChange} />);
        case 'map': return renderWithLayoutPicker(<MapForm data={block.data} onChange={handleDataChange} />);
        case 'image_gallery': return renderWithLayoutPicker(<ImageGalleryBlockForm data={block.data} onChange={handleDataChange} />);
        
        case 'quick_actions':
            return <QuickActionsBlockForm data={block.data} onChange={handleDataChange} />;

        // System blocks (configured elsewhere, with minimal title override)
        case 'hours':
        case 'featured_product':
        case 'branches':
            return <SystemBlockForm data={block.data} onChange={handleDataChange} blockType={block.type} />;

        default:
            if (moduleInfo) {
                return (
                    <div className="space-y-4">
                        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center shadow-lg text-neutral-200">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-neutral-200 text-sm">{moduleInfo.name}</h4>
                                    <p className="text-xs text-neutral-500 font-medium">Module is active</p>
                                </div>
                            </div>
                        </div>

                        {moduleInfo.description && (
                            <p className="text-sm text-neutral-400 leading-relaxed">{moduleInfo.description}</p>
                        )}

                        {moduleInfo.manageUrl && (
                            <Link 
                                href={moduleInfo.manageUrl}
                                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-xl font-bold hover:bg-neutral-700 hover:text-neutral-100 transition-all shadow-sm"
                            >
                                <ExternalLink size={18} />
                                Configure {moduleInfo.name} Settings
                            </Link>
                        )}

                    </div>
                );
            }
            return (
                <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-800/30">
                    <p className="text-sm font-bold text-amber-200">Unsupported block type: {block.type}</p>
                </div>
            );
    }
});

BlockFormRenderer.displayName = 'BlockFormRenderer';
