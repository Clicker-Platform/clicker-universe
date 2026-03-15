'use client';

import { AlignLeft, AlignCenter, AlignRight, Plus, Trash2 } from 'lucide-react';
import { BlockImageUploader } from '../BlockImageUploader';
import { useState, useEffect, useRef, useCallback } from 'react';

interface HeroFormProps {
    data: any;
    onChange: (data: any) => void;
}

const ALIGN_OPTIONS = [
    { value: 'left', icon: AlignLeft, label: 'Left' },
    { value: 'center', icon: AlignCenter, label: 'Center' },
    { value: 'right', icon: AlignRight, label: 'Right' },
] as const;

// Map CSS keyword positions to percentages for the focal point picker
const KEYWORD_TO_PCT: Record<string, [number, number]> = {
    center: [50, 50], top: [50, 0], bottom: [50, 100],
    left: [0, 50], right: [100, 50],
    'top left': [0, 0], 'top right': [100, 0],
    'bottom left': [0, 100], 'bottom right': [100, 100],
};

function parseFocalPoint(value: string): [number, number] {
    if (KEYWORD_TO_PCT[value]) return KEYWORD_TO_PCT[value];
    const match = value.match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
    if (match) return [parseFloat(match[1]), parseFloat(match[2])];
    return [50, 50];
}

function FocalPointPicker({ imageUrl, value, onChange }: {
    imageUrl: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const [focal, setFocal] = useState<[number, number]>(() => parseFocalPoint(value));

    useEffect(() => { setFocal(parseFocalPoint(value)); }, [value]);

    const updateFromEvent = useCallback((e: MouseEvent | TouchEvent) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const x = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
        const y = Math.round(Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)));
        setFocal([x, y]);
        onChange(`${x}% ${y}%`);
    }, [onChange]);

    useEffect(() => {
        const onMove = (e: MouseEvent | TouchEvent) => { if (isDragging.current) updateFromEvent(e); };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [updateFromEvent]);

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        isDragging.current = true;
        updateFromEvent(e.nativeEvent as MouseEvent | TouchEvent);
    };

    return (
        <div>
            <label className="block text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">
                Focal Point <span className="normal-case font-normal text-neutral-600 ml-1">drag to set focus area</span>
            </label>
            <div
                ref={containerRef}
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none border border-neutral-700"
                style={{ height: 140, backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: `${focal[0]}% ${focal[1]}%` }}
            >
                {/* Focal point dot */}
                <div
                    className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none"
                    style={{
                        left: `${focal[0]}%`,
                        top: `${focal[1]}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(59,130,246,0.8)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.5)',
                    }}
                />
                {/* Crosshair lines */}
                <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${focal[0]}%`, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${focal[1]}%`, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
            </div>
            <p className="text-[10px] text-neutral-600 mt-1 font-mono">
                x: {focal[0]}% &nbsp; y: {focal[1]}%
            </p>
        </div>
    );
}

const TITLE_SIZES = [
    { value: 'sm', label: 'S' },
    { value: 'md', label: 'M' },
    { value: 'lg', label: 'L' },
    { value: 'xl', label: 'XL' },
];

const inputClass = "w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider";
const sectionClass = "p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 space-y-3";

const ColorInput = ({ label, value, onChange, onClear }: {
    label: string;
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
        const hex = e.target.value;
        setTextVal(hex);
        onChange(hex);
    };

    return (
        <div className="flex items-center gap-2 mt-1.5">
            <label className="w-8 h-8 rounded-lg border border-neutral-600 cursor-pointer overflow-hidden flex-shrink-0 relative"
                style={{ backgroundColor: value || '#525252' }}>
                <input type="color" value={value || '#525252'} onChange={handleNativePicker}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
            </label>
            <input type="text" value={textVal} onChange={(e) => handleText(e.target.value)}
                placeholder="e.g. #ffffff"
                className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-500 font-mono" />
            {value && (
                <button type="button" onClick={onClear}
                    className="text-neutral-500 hover:text-red-400 transition-colors text-xs px-1 font-bold">
                    ×
                </button>
            )}
        </div>
    );
};

export const HeroForm = ({ data, onChange }: HeroFormProps) => {
    const safeData = data || {};

    const handleChange = (field: string, value: string | boolean | object | null) => {
        onChange({ ...safeData, [field]: value });
    };

    const primaryBtn = safeData.primaryBtn || null;
    const secondaryBtn = safeData.secondaryBtn || null;
    const currentAlign = safeData.textAlign || '';
    const currentPosition = safeData.imagePosition || 'center';

    return (
        <div className="space-y-4">

            {/* Tagline */}
            <div>
                <label className={labelClass}>Tagline</label>
                <input type="text" value={safeData.tagline || ''} onChange={(e) => handleChange('tagline', e.target.value)}
                    className={inputClass} placeholder="e.g. Your quality brand" />
                <div className="mt-1.5">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1">Tagline Color</label>
                    <ColorInput value={safeData.taglineColor} onChange={(hex) => handleChange('taglineColor', hex)}
                        onClear={() => handleChange('taglineColor', null)} label="Tagline Color" />
                </div>
            </div>

            {/* Title + size */}
            <div>
                <label className={labelClass}>Title</label>
                <input type="text" value={safeData.title || ''} onChange={(e) => handleChange('title', e.target.value)}
                    className={inputClass} placeholder="Welcome to our page" />
                <div className="flex gap-1 p-1 mt-2 bg-neutral-900 rounded-xl border border-neutral-800">
                    {TITLE_SIZES.map(({ value, label }) => (
                        <button key={value} type="button" onClick={() => handleChange('titleSize', value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                (safeData.titleSize || 'md') === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="mt-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1">Title Color</label>
                    <ColorInput value={safeData.titleColor} onChange={(hex) => handleChange('titleColor', hex)}
                        onClear={() => handleChange('titleColor', null)} label="Title Color" />
                </div>
            </div>

            {/* Subtitle */}
            <div>
                <label className={labelClass}>Subtitle</label>
                <input type="text" value={safeData.subtitle || ''} onChange={(e) => handleChange('subtitle', e.target.value)}
                    className={inputClass} placeholder="Brief description or tagline" />
                <div className="mt-1.5">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1">Subtitle Color</label>
                    <ColorInput value={safeData.subtitleColor} onChange={(hex) => handleChange('subtitleColor', hex)}
                        onClear={() => handleChange('subtitleColor', null)} label="Subtitle Color" />
                </div>
            </div>

            {/* Text Alignment */}
            <div>
                <label className={`${labelClass} mb-1.5`}>Text Alignment</label>
                <div className="flex gap-1 p-1 bg-neutral-900 rounded-xl border border-neutral-800">
                    {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
                        <button key={value} type="button" title={label} onClick={() => handleChange('textAlign', value)}
                            className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all text-sm font-medium ${
                                currentAlign === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                            }`}>
                            <Icon size={15} />
                        </button>
                    ))}
                </div>
            </div>

            {/* CTA Buttons */}
            <div>
                <label className={labelClass}>Buttons</label>
                <div className="space-y-2">

                    {/* Primary Button */}
                    {primaryBtn ? (
                        <div className={sectionClass}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Primary</span>
                                <button type="button" onClick={() => handleChange('primaryBtn', null)}
                                    className="text-neutral-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            <input type="text" value={primaryBtn.label || ''} placeholder="Button label"
                                onChange={(e) => handleChange('primaryBtn', { ...primaryBtn, label: e.target.value })}
                                className={inputClass} />
                            <input type="text" value={primaryBtn.url || ''} placeholder="https://... or /page"
                                onChange={(e) => handleChange('primaryBtn', { ...primaryBtn, url: e.target.value })}
                                className={inputClass} />
                        </div>
                    ) : (
                        <button type="button" onClick={() => handleChange('primaryBtn', { label: 'Get Started', url: '' })}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-neutral-700 text-xs font-bold text-neutral-500 hover:text-blue-400 hover:border-blue-500/50 transition-all">
                            <Plus size={13} /> Add Primary Button
                        </button>
                    )}

                    {/* Secondary Button — only show add option once primary exists */}
                    {primaryBtn && (
                        secondaryBtn ? (
                            <div className={sectionClass}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Secondary</span>
                                    <button type="button" onClick={() => handleChange('secondaryBtn', null)}
                                        className="text-neutral-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                <input type="text" value={secondaryBtn.label || ''} placeholder="Button label"
                                    onChange={(e) => handleChange('secondaryBtn', { ...secondaryBtn, label: e.target.value })}
                                    className={inputClass} />
                                <input type="text" value={secondaryBtn.url || ''} placeholder="https://... or /page"
                                    onChange={(e) => handleChange('secondaryBtn', { ...secondaryBtn, url: e.target.value })}
                                    className={inputClass} />
                            </div>
                        ) : (
                            <button type="button" onClick={() => handleChange('secondaryBtn', { label: 'Learn More', url: '' })}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-neutral-700 text-xs font-bold text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-all">
                                <Plus size={13} /> Add Secondary Button
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Hero Image */}
            <div>
                <BlockImageUploader label="Hero Image" currentUrl={safeData.imageUrl}
                    onUpload={(url) => handleChange('imageUrl', url)}
                    onRemove={() => handleChange('imageUrl', '')} />
            </div>

            {/* Image controls — only when image is set */}
            {safeData.imageUrl && (
                <>
                    <FocalPointPicker
                        imageUrl={safeData.imageUrl}
                        value={currentPosition}
                        onChange={(v) => handleChange('imagePosition', v)}
                    />

                    <div className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-xl border border-neutral-800">
                        <div>
                            <p className="text-sm font-semibold text-neutral-200">Full-width image</p>
                            <p className="text-xs text-neutral-500 mt-0.5">Remove rounded corners — image bleeds to edges</p>
                        </div>
                        <button type="button" onClick={() => handleChange('imageFullWidth', !safeData.imageFullWidth)}
                            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${safeData.imageFullWidth ? 'bg-blue-600' : 'bg-neutral-700'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${safeData.imageFullWidth ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
