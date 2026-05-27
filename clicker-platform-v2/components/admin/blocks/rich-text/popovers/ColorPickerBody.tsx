// clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPickerBody.tsx
'use client';

import { useState } from 'react';
import { HEX_REGEX, type ColorToken } from '../tokens';

interface Props {
    tokens: readonly ColorToken[];
    recent: string[];
    onPickToken: (id: string) => void;
    onPickHex: (hex: string) => void;
    onClear?: () => void;
}

export function ColorPickerBody({ tokens, recent, onPickToken, onPickHex, onClear }: Props) {
    const [hexInput, setHexInput] = useState('');
    const inputOk = HEX_REGEX.test(hexInput);

    return (
        <div className="p-3 min-w-[220px]">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2">Theme colors</div>
            <div className="grid grid-cols-8 gap-1.5">
                {tokens.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onPickToken(t.id)}
                        title={t.label}
                        className="w-6 h-6 rounded-md border border-black/10 hover:scale-110 transition-transform"
                        style={{ background: t.cssVar }}
                    />
                ))}
            </div>

            {recent.length > 0 && (
                <>
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500 mt-3 mb-2">Recent</div>
                    <div className="grid grid-cols-8 gap-1.5">
                        {recent.map((hex, i) => (
                            <button
                                key={`${hex}-${i}`}
                                type="button"
                                onClick={() => onPickHex(hex)}
                                title={hex}
                                className="w-6 h-6 rounded-md border border-black/10 hover:scale-110 transition-transform"
                                style={{ background: hex }}
                            />
                        ))}
                    </div>
                </>
            )}

            <div className="mt-3 flex gap-1.5">
                <input
                    type="text"
                    value={hexInput}
                    onChange={e => setHexInput(e.target.value)}
                    placeholder="#aabbcc"
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
                <button
                    type="button"
                    disabled={!inputOk}
                    onClick={() => { onPickHex(hexInput); setHexInput(''); }}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Apply
                </button>
            </div>

            {onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="w-full mt-2 px-2 py-1 text-xs text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md"
                >
                    Clear
                </button>
            )}
        </div>
    );
}
