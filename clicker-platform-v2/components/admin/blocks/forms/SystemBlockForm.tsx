'use client';

import { Type, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface SystemBlockFormProps {
    data: any;
    onChange: (data: any) => void;
    blockType: string;
}

export function SystemBlockForm({ data, onChange, blockType }: SystemBlockFormProps) {
    const handleChange = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    const getSettingsLink = () => {
        switch (blockType) {
            case 'quick_actions':
                return { url: '/admin/canvas', label: 'Canvas Studio (Header Navigation)' };
            case 'hours':
            case 'branches':
                return { url: '/admin/profile', label: 'Business Profile' };
            case 'featured_product':
                return { url: '/admin/products', label: 'Products Sandbox' };
            default:
                return null;
        }
    };

    const settingsLink = getSettingsLink();

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-blue-500/5 rounded-2xl p-5 border border-blue-500/10 mb-6">
                <h4 className="font-black text-blue-400 text-xs uppercase tracking-widest mb-2">Dynamic System Block</h4>
                <p className="text-sm text-neutral-400 leading-relaxed">
                    The content for this block is automatically generated from your global settings.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-2">
                        <Type size={14} className="text-neutral-500" />
                        Section Title Override
                    </label>
                    <input
                        type="text"
                        value={data.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                        placeholder="Leave blank for default"
                        className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-bold text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                    <p className="text-xs text-neutral-500 mt-2 font-medium leading-relaxed">
                        Optional: Provide a custom title to display above this section. Leave empty to use the default or hide the title.
                    </p>
                </div>
            </div>

            {settingsLink && (
                 <div className="pt-6 border-t border-neutral-800">
                     <h5 className="font-bold text-neutral-200 text-xs uppercase tracking-wider mb-4">Manage Content</h5>
                     <Link
                         href={settingsLink.url}
                         className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl font-bold hover:bg-neutral-700 transition-all active:scale-[0.98]"
                     >
                         Edit {settingsLink.label}
                         <ExternalLink size={16} />
                     </Link>
                 </div>
            )}
        </div>
    );
}
