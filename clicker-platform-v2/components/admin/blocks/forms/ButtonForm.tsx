'use client';

import { LinkPicker, LinkValue } from './LinkPicker';

interface ButtonFormProps {
    data: any;
    onChange: (data: any) => void;
}

interface SecondaryButtonData {
    label?: string;
    /** @deprecated use tier instead; kept for back-compat */
    variant?: 'primary' | 'secondary' | 'outline';
    tier?: 'primary' | 'secondary' | 'tertiary';
    size?: 'sm' | 'md' | 'lg';
    linkType?: 'url' | 'page' | 'form';
    url?: string;
    pageId?: string | null;
    formId?: string | null;
    openInNewTab?: boolean;
}

export const ButtonForm = ({ data, onChange }: ButtonFormProps) => {
    const safeData = data || {};
    const secondary: SecondaryButtonData | undefined = safeData.secondary;

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

    const updateSecondary = (patch: Partial<SecondaryButtonData>) => {
        onChange({ ...safeData, secondary: { ...(secondary || {}), ...patch } });
    };

    const handleSecondaryLinkChange = (next: LinkValue) => {
        updateSecondary({
            linkType: next.type,
            url: next.url || '',
            pageId: next.pageId ?? null,
            formId: next.formId ?? null,
        });
    };

    const addSecondary = () => {
        onChange({
            ...safeData,
            secondary: {
                label: 'Learn More',
                tier: 'secondary',
                size: 'md',
                linkType: 'url',
                url: '',
            },
        });
    };

    const removeSecondary = () => {
        const next = { ...safeData };
        delete next.secondary;
        onChange(next);
    };

    const secondaryLinkValue: LinkValue = {
        type: secondary?.linkType || 'url',
        url: secondary?.url || '',
        pageId: secondary?.pageId ?? null,
        formId: secondary?.formId ?? null,
    };
    const secondaryUrl = (secondary?.url || '').trim();
    const secondaryIsExternal = /^(https?:\/\/|mailto:|tel:)/i.test(secondaryUrl);
    const secondaryNewTabChecked = secondaryIsExternal || secondary?.openInNewTab === true;

    const inputClass = 'w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium';
    const labelClass = 'block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelClass}>Button Text</label>
                    <input
                        type="text"
                        value={safeData.label || ''}
                        onChange={(e) => handleChange('label', e.target.value)}
                        className={inputClass}
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
                    <label className={labelClass}>Tier</label>
                    <select
                        value={safeData.tier || 'primary'}
                        onChange={(e) => handleChange('tier', e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer`}
                    >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="tertiary">Tertiary</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Size</label>
                    <select
                        value={safeData.size || 'md'}
                        onChange={(e) => handleChange('size', e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer`}
                    >
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Alignment</label>
                    <select
                        value={safeData.align || 'center'}
                        onChange={(e) => handleChange('align', e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer`}
                    >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="full">Full Width</option>
                    </select>
                </div>
            </div>

            {!secondary && (
                <button
                    type="button"
                    onClick={addSecondary}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                    + Add secondary button
                </button>
            )}

            {secondary && (
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Secondary button</span>
                        <button
                            type="button"
                            onClick={removeSecondary}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                        >
                            Remove
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Button Text</label>
                            <input
                                type="text"
                                value={secondary.label || ''}
                                onChange={(e) => updateSecondary({ label: e.target.value })}
                                className={inputClass}
                                placeholder="Learn More"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <LinkPicker value={secondaryLinkValue} onChange={handleSecondaryLinkChange} />
                            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                                <input
                                    type="checkbox"
                                    checked={secondaryNewTabChecked}
                                    disabled={secondaryIsExternal}
                                    onChange={(e) => updateSecondary({ openInNewTab: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-neutral-700"
                                />
                                Open in new tab{secondaryIsExternal ? ' (auto for external links)' : ''}
                            </label>
                        </div>
                        <div>
                            <label className={labelClass}>Tier</label>
                            <select
                                value={secondary.tier || 'secondary'}
                                onChange={(e) => updateSecondary({ tier: e.target.value as SecondaryButtonData['tier'] })}
                                className={`${inputClass} appearance-none cursor-pointer`}
                            >
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                                <option value="tertiary">Tertiary</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Size</label>
                            <select
                                value={secondary.size || 'md'}
                                onChange={(e) => updateSecondary({ size: e.target.value as SecondaryButtonData['size'] })}
                                className={`${inputClass} appearance-none cursor-pointer`}
                            >
                                <option value="sm">Small</option>
                                <option value="md">Medium</option>
                                <option value="lg">Large</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
