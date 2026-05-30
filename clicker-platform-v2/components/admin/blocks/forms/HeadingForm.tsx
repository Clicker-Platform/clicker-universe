'use client';

import { AlignLeft, AlignCenter, AlignRight, Plus, Trash2, Bold, Underline } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeadingFormProps {
    data: any;
    onChange: (data: any) => void;
}

const inputClass = "w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

const ALIGN_OPTIONS = [
    { value: 'left',   icon: AlignLeft,   label: 'Left' },
    { value: 'center', icon: AlignCenter, label: 'Center' },
    { value: 'right',  icon: AlignRight,  label: 'Right' },
] as const;

// Display tiers (3XL/2XL) sit above XL. SM kept for back-compat.
const HEADING_SIZES = [
    { value: '3xl', label: '3XL' },
    { value: '2xl', label: '2XL' },
    { value: 'xl', label: 'XL' },
    { value: 'lg', label: 'LG' },
    { value: 'md', label: 'MD' },
] as const;

// Sub-heading size presets — all land above body text, below the heading.
const SUBHEADING_SIZES = [
    { value: 's',  label: 'S' },
    { value: 'm',  label: 'M' },
    { value: 'l',  label: 'L' },
    { value: 'xl', label: 'XL' },
] as const;

/**
 * Swatch + hex input with a clear-to-reset button. Empty value = inherit the
 * theme foreground (shown via the placeholder). Mirrors the ColorInput pattern
 * in HeroForm so colour controls behave identically across block forms.
 */
const ColorInput = ({ value, onChange, onClear }: {
    value?: string;
    onChange: (hex: string) => void;
    onClear: () => void;
}) => {
    const [textVal, setTextVal] = useState(value || '');
    useEffect(() => { setTextVal(value || ''); }, [value]);

    const isValidHex = (s: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
    const handleText = (raw: string) => {
        const hex = raw.startsWith('#') ? raw : `#${raw}`;
        setTextVal(raw);
        if (isValidHex(hex)) onChange(hex);
    };
    const handleNativePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTextVal(e.target.value);
        onChange(e.target.value);
    };
    const swatchColor = value || '#525252';

    return (
        <div className="flex items-center gap-2">
            <label className="w-8 h-8 rounded-lg border border-gray-400 dark:border-neutral-600 cursor-pointer overflow-hidden flex-shrink-0 relative"
                style={{ backgroundColor: swatchColor }}>
                <input type="color" value={swatchColor} onChange={handleNativePicker}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
            </label>
            <input type="text" value={textVal} onChange={(e) => handleText(e.target.value)}
                placeholder="Theme default"
                className="min-w-0 w-full px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-blue-500 font-mono" />
            {value && (
                <button type="button" onClick={onClear}
                    className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors text-xs px-1 font-bold">
                    ×
                </button>
            )}
        </div>
    );
};

export function HeadingForm({ data, onChange }: HeadingFormProps) {
    const safe = data || {};
    const set = (field: string, value: any) => onChange({ ...safe, [field]: value });

    const alignBtns = (field: 'headingAlign' | 'subheadingAlign') => {
        const current = safe[field] ?? 'left';
        return (
            <div className="flex gap-0.5 flex-shrink-0">
                {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
                    <button
                        key={value}
                        type="button"
                        title={label}
                        onClick={() => set(field, value)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                            current === value
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                        }`}
                    >
                        <Icon size={14} />
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">

            {/* Heading */}
            <div>
                <label className={labelClass}>Heading</label>
                <input
                    type="text"
                    value={safe.heading || ''}
                    onChange={(e) => set('heading', e.target.value)}
                    placeholder="Your Headline"
                    className={inputClass}
                />
                <div className="flex gap-1 p-1 mt-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {HEADING_SIZES.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => set('headingSize', value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                (safe.headingSize || 'xl') === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">Alignment</span>
                    {alignBtns('headingAlign')}
                </div>
                <div className="mt-2">
                    <label className={labelClass}>Text Color</label>
                    <ColorInput
                        value={safe.headingColor}
                        onChange={(hex) => set('headingColor', hex)}
                        onClear={() => set('headingColor', null)}
                    />
                </div>
            </div>

            {/* Sub-heading */}
            <div>
                {safe.subheading !== null && safe.subheading !== undefined ? (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <label className={labelClass}>Sub-heading</label>
                            <button
                                type="button"
                                onClick={() => set('subheading', null)}
                                className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={safe.subheading || ''}
                            onChange={(e) => set('subheading', e.target.value)}
                            placeholder="Supporting text"
                            className={inputClass}
                        />
                        <div className="flex gap-1 p-1 mt-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                            {SUBHEADING_SIZES.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => set('subheadingSize', value)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        (safe.subheadingSize || 'm') === value
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">Style</span>
                            <div className="flex gap-0.5 flex-shrink-0">
                                <button
                                    type="button"
                                    title="Bold"
                                    onClick={() => set('subheadingBold', !safe.subheadingBold)}
                                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                        safe.subheadingBold
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}
                                >
                                    <Bold size={14} />
                                </button>
                                <button
                                    type="button"
                                    title="Underline"
                                    onClick={() => set('subheadingUnderline', !safe.subheadingUnderline)}
                                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                        safe.subheadingUnderline
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}
                                >
                                    <Underline size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">Alignment</span>
                            {alignBtns('subheadingAlign')}
                        </div>
                        <div className="mt-2">
                            <label className={labelClass}>Text Color</label>
                            <ColorInput
                                value={safe.subheadingColor}
                                onChange={(hex) => set('subheadingColor', hex)}
                                onClear={() => set('subheadingColor', null)}
                            />
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => set('subheading', '')}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
                    >
                        <Plus size={13} />
                        Add Sub-heading
                    </button>
                )}
            </div>

            {/* Vertical Spacing */}
            <div>
                <label className={labelClass}>Vertical Spacing</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['small', 'medium', 'tall'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('verticalSpacing', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safe.verticalSpacing || 'medium') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'small' ? 'Small' : v === 'medium' ? 'Medium' : 'Tall'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Horizontal Padding */}
            <div>
                <label className={labelClass}>Horizontal Padding</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['none', 'normal', 'wide'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('horizontalPadding', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safe.horizontalPadding || 'none') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'none' ? 'None' : v === 'normal' ? 'Normal' : 'Wide'}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
}
