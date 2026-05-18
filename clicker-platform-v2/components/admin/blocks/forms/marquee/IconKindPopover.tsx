'use client';

import React, { useState, useRef, useEffect } from 'react';
import { IconSelector } from '@/components/admin/IconSelector';
import { MarqueeIcon } from '@/components/blocks/marquee/types';
import { sanitizeSvgIcon } from '@/lib/sanitizeSvgIcon';
import { SafeSvgIcon } from '@/components/blocks/public/SafeSvgIcon';

interface IconKindPopoverProps {
    icon: MarqueeIcon;
    onChange: (next: MarqueeIcon) => void;
    trigger: React.ReactNode;
}

export const IconKindPopover: React.FC<IconKindPopoverProps> = ({ icon, onChange, trigger }) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'pick' | 'paste'>(icon.kind === 'svg' ? 'paste' : 'pick');
    const [svgDraft, setSvgDraft] = useState(icon.kind === 'svg' ? icon.svg : '');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const previewSafe = svgDraft ? sanitizeSvgIcon(svgDraft) : '';

    return (
        <div className="relative inline-block" ref={ref}>
            <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
            {open && (
                <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                    <div className="flex gap-1 mb-3 border-b border-gray-100">
                        <button
                            type="button"
                            onClick={() => setTab('pick')}
                            className={`px-3 py-1 text-sm ${tab === 'pick' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                        >
                            Pick
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('paste')}
                            className={`px-3 py-1 text-sm ${tab === 'paste' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                        >
                            Paste SVG
                        </button>
                    </div>

                    {tab === 'pick' && (
                        <IconSelector
                            selectedIcon={icon.kind === 'lucide' ? icon.name : ''}
                            onSelect={(name) => {
                                onChange({ kind: 'lucide', name });
                                setOpen(false);
                            }}
                            onClose={() => setOpen(false)}
                        />
                    )}

                    {tab === 'paste' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500">
                                Paste SVG markup from <a href="https://lucide.dev" target="_blank" rel="noreferrer" className="underline">lucide.dev</a> (&quot;Copy SVG&quot;), Heroicons, etc.
                            </p>
                            <textarea
                                value={svgDraft}
                                onChange={(e) => setSvgDraft(e.target.value)}
                                placeholder="<svg xmlns=...>...</svg>"
                                rows={5}
                                className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Preview:</span>
                                    <span className="inline-flex items-center justify-center w-6 h-6 border border-gray-200 rounded" style={{ fontSize: 20 }}>
                                        {previewSafe ? <SafeSvgIcon svg={svgDraft} /> : <span className="text-gray-300">—</span>}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => { setSvgDraft(''); onChange({ kind: 'lucide', name: 'Star' }); }}
                                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!previewSafe}
                                        onClick={() => { onChange({ kind: 'svg', svg: svgDraft }); setOpen(false); }}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-gray-300"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
