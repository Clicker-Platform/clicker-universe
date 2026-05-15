'use client';

import { LinkPicker, LinkValue } from './LinkPicker';

interface ButtonFormProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

export const ButtonForm = ({ data, onChange }: ButtonFormProps) => {
    const safeData = (data || {}) as {
        linkType?: LinkValue['type'];
        url?: string;
        pageId?: string | null;
        formId?: string | null;
        label?: string;
        variant?: string;
        align?: string;
        openInNewTab?: boolean;
    };

    const handleChange = (field: string, value: string | boolean) => {
        onChange({ ...safeData, [field]: value });
    };

    const handleLinkChange = (next: LinkValue) => {
        onChange({
            ...safeData,
            linkType: next.type,
            url: next.url || '',
            pageId: next.pageId ?? null,
            formId: next.formId ?? null,
        });
    };

    const linkValue: LinkValue = {
        type: safeData.linkType || 'url',
        url: safeData.url || '',
        pageId: safeData.pageId ?? null,
        formId: safeData.formId ?? null,
    };

    const url = (safeData.url || '').trim();
    const isExternal = /^(https?:\/\/|mailto:|tel:)/i.test(url);
    const newTabChecked = isExternal || safeData.openInNewTab === true;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Button Text</label>
                <input
                    type="text"
                    value={safeData.label || ''}
                    onChange={(e) => handleChange('label', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                    placeholder="Click Here"
                />
            </div>
            <div className="md:col-span-2">
                <LinkPicker value={linkValue} onChange={handleLinkChange} />
                <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                    <input
                        type="checkbox"
                        checked={newTabChecked}
                        disabled={isExternal}
                        onChange={(e) => handleChange('openInNewTab', e.target.checked)}
                        className="rounded border-gray-300 dark:border-neutral-700"
                    />
                    Open in new tab{isExternal ? ' (auto for external links)' : ''}
                </label>
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Style</label>
                <select
                    value={safeData.variant || 'primary'}
                    onChange={(e) => handleChange('variant', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium appearance-none cursor-pointer"
                >
                    <option value="primary">Solid (Brand)</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Alignment</label>
                <select
                    value={safeData.align || 'center'}
                    onChange={(e) => handleChange('align', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium appearance-none cursor-pointer"
                >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="full">Full Width</option>
                </select>
            </div>
        </div>
    );
};
