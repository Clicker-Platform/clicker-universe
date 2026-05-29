'use client';

import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Plus, Trash2, ImageIcon, Palette, Square } from 'lucide-react';
import { BlockImageUploader } from '../BlockImageUploader';
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useSite } from '@/lib/site-context';
import { SelectMenu } from './SelectMenu';

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

function FocalPointPicker({ imageUrl, value, onChange, label: pickerLabel }: {
    imageUrl: string;
    value: string;
    onChange: (v: string) => void;
    label?: string;
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
            <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">
                {pickerLabel ?? 'Focal Point'} <span className="normal-case font-normal text-neutral-400 dark:text-neutral-600 ml-1">drag to set focus area</span>
            </label>
            <div
                ref={containerRef}
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                className="relative w-full rounded-lg overflow-hidden cursor-crosshair select-none border border-gray-300 dark:border-neutral-700"
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
            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1 font-mono">
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

const inputClass = "w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";
const sectionClass = "p-3 bg-gray-100/50 dark:bg-neutral-900/50 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-3";

const ColorInput = ({ label, value, resolvedValue, onChange, onClear }: {
    label: string;
    value?: string;
    resolvedValue?: string; // effective color when no override is set — shown as placeholder
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

    const swatchColor = value || resolvedValue || '#525252';

    return (
        <div className="flex items-center gap-2">
            <label className="w-8 h-8 rounded-lg border border-gray-400 dark:border-neutral-600 cursor-pointer overflow-hidden flex-shrink-0 relative"
                style={{ backgroundColor: swatchColor }}>
                <input type="color" value={swatchColor} onChange={handleNativePicker}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
            </label>
            <input type="text" value={textVal} onChange={(e) => handleText(e.target.value)}
                placeholder={resolvedValue || 'e.g. #ffffff'}
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

export const HeroForm = ({ data, onChange }: HeroFormProps) => {
    const safeData = data || {};
    const { siteId } = useSite();
    const [pages, setPages] = useState<any[]>([]);
    const [forms, setForms] = useState<any[]>([]);

    useEffect(() => {
        if (!siteId) return;
        Promise.all([
            getDocs(collection(db, 'sites', siteId, 'pages')),
            getDocs(collection(db, 'sites', siteId, 'forms')),
        ]).then(([pSnap, fSnap]) => {
            setPages(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setForms(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [siteId]);

    const handleChange = (field: string, value: string | boolean | object | null) => {
        onChange({ ...safeData, [field]: value });
    };

    const primaryBtn = safeData.primaryBtn || null;
    const secondaryBtn = safeData.secondaryBtn || null;
    const currentPosition = safeData.imagePosition || 'center';
    const currentPositionMobile = safeData.imagePositionMobile || currentPosition;

    // Background mode — derive sensible default from saved data
    const hasImage = !!(safeData.imageUrl && safeData.imageUrl.trim() !== '');
    const bgMode: string = safeData.bgMode ?? (hasImage ? 'image' : 'color');

    // Resolved default colors (mirrors DefaultHeroBlock logic)
    const isDarkBg = safeData.textColorMode === 'light' || (!safeData.textColorMode && (bgMode === 'image' || bgMode === 'color' && safeData.bgColor && safeData.bgColor < '#888888'));
    const resolvedTitleColor = isDarkBg ? '#ffffff' : '#111111';
    const resolvedSubtitleColor = isDarkBg ? 'rgba(255,255,255,0.80)' : '#4b5563';
    const resolvedTaglineColor = isDarkBg ? 'rgba(255,255,255,0.55)' : '#6b7280';

    const alignBtns = (field: 'taglineAlign' | 'titleAlign' | 'subtitleAlign' | 'ctaAlign') => {
        const current = safeData[field] ?? safeData.textAlign ?? '';
        return (
            <div className="flex gap-0.5 flex-shrink-0">
                {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
                    <button key={value} type="button" title={label}
                        onClick={() => handleChange(field, value)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                            current === value
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                        }`}>
                        <Icon size={14} />
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">

            {/* ── Background ────────────────────────────────────────────── */}
            <div>
                <label className={labelClass}>Background</label>
                {/* Mode selector */}
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {([
                        { value: 'image',       icon: ImageIcon, label: 'Image' },
                        { value: 'color',       icon: Palette,   label: 'Color' },
                        { value: 'transparent', icon: Square,    label: 'None' },
                    ] as const).map(({ value, icon: Icon, label }) => (
                        <button key={value} type="button"
                            onClick={() => handleChange('bgMode', value)}
                            title={label}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                                bgMode === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}>
                            <Icon size={13} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Solid colour picker — only when mode is 'color' */}
                {bgMode === 'color' && (
                    <div className="mt-2">
                        <label className={labelClass}>Background Color</label>
                        <ColorInput
                            label="Background Color"
                            value={safeData.bgColor}
                            onChange={(hex) => handleChange('bgColor', hex)}
                            onClear={() => handleChange('bgColor', null)}
                        />
                    </div>
                )}

                {/* Hero Image — only shown when bgMode is 'image' */}
                {bgMode === 'image' && (
                    <div className="mt-4 space-y-4">
                        <div>
                            <BlockImageUploader label="Hero Image (Desktop)" currentUrl={safeData.imageUrl}
                                onUpload={(url) => handleChange('imageUrl', url)}
                                onRemove={() => handleChange('imageUrl', '')} />
                        </div>

                        {/* Image controls — only when image is set */}
                        {safeData.imageUrl && (
                            <div className="p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-4">
                                <FocalPointPicker
                                    imageUrl={safeData.imageUrl}
                                    value={currentPosition}
                                    onChange={(v) => handleChange('imagePosition', v)}
                                    label="Focal Point — Desktop"
                                />
                                <FocalPointPicker
                                    imageUrl={safeData.imageUrl}
                                    value={currentPositionMobile}
                                    onChange={(v) => handleChange('imagePositionMobile', v)}
                                    label="Focal Point — Mobile"
                                />
                            </div>
                        )}

                        {/* Optional separate mobile image */}
                        <div className="pt-2 border-t border-gray-100 dark:border-neutral-800">
                            <BlockImageUploader label="Mobile Image (optional override)" currentUrl={safeData.imageUrlMobile}
                                onUpload={(url) => handleChange('imageUrlMobile', url)}
                                onRemove={() => handleChange('imageUrlMobile', '')} />
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1.5 px-1 leading-relaxed">
                                Upload a portrait-cropped version for mobile. If left empty, the desktop image is used with the mobile focal point above.
                            </p>
                            {safeData.imageUrlMobile && (
                                <div className="mt-3 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-gray-200 dark:border-neutral-800">
                                    <FocalPointPicker
                                        imageUrl={safeData.imageUrlMobile}
                                        value={currentPositionMobile}
                                        onChange={(v) => handleChange('imagePositionMobile', v)}
                                        label="Focal Point — Mobile Image"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Text Color Mode ───────────────────────────────────────── */}
            <div>
                <label className={labelClass}>Text Color Mode</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {([
                        { value: 'auto',  label: 'Auto' },
                        { value: 'light', label: 'Force Light' },
                        { value: 'dark',  label: 'Force Dark' },
                    ] as const).map(({ value, label }) => (
                        <button key={value} type="button"
                            onClick={() => handleChange('textColorMode', value === 'auto' ? null : value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                (safeData.textColorMode ?? 'auto') === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1 px-0.5">
                    Auto adapts to background. Force Light = white text. Force Dark = black text. Per-field colors below override this.
                </p>
            </div>

            {/* Tagline */}
            <div data-field="tagline">
                {safeData.tagline !== null && safeData.tagline !== undefined ? (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <label className={labelClass}>Tagline</label>
                            <button type="button" onClick={() => handleChange('tagline', null)}
                                className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>
                        <input type="text" value={safeData.tagline || ''} onChange={(e) => handleChange('tagline', e.target.value)}
                            className={inputClass} placeholder="e.g. Your quality brand" />
                        <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1">
                                <ColorInput value={safeData.taglineColor} resolvedValue={resolvedTaglineColor} onChange={(hex) => handleChange('taglineColor', hex)}
                                    onClear={() => handleChange('taglineColor', null)} label="Tagline Color" />
                            </div>
                            {alignBtns('taglineAlign')}
                        </div>
                    </>
                ) : (
                    <button type="button" onClick={() => handleChange('tagline', '')}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-colors">
                        <Plus size={13} />
                        Add Tagline
                    </button>
                )}
            </div>

            {/* Title + size */}
            <div data-field="title">
                {safeData.title !== null && safeData.title !== undefined ? (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <label className={labelClass}>Title</label>
                            <button type="button" onClick={() => handleChange('title', null)}
                                className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>
                        <input type="text" value={safeData.title || ''} onChange={(e) => handleChange('title', e.target.value)}
                            className={inputClass} placeholder="Welcome to our page" />
                        <div className="flex gap-1 p-1 mt-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                            {TITLE_SIZES.map(({ value, label }) => (
                                <button key={value} type="button" onClick={() => handleChange('titleSize', value)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        (safeData.titleSize || 'md') === value
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1">
                                <ColorInput value={safeData.titleColor} resolvedValue={resolvedTitleColor} onChange={(hex) => handleChange('titleColor', hex)}
                                    onClear={() => handleChange('titleColor', null)} label="Title Color" />
                            </div>
                            {alignBtns('titleAlign')}
                        </div>
                    </>
                ) : (
                    <button type="button" onClick={() => handleChange('title', '')}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-colors">
                        <Plus size={13} />
                        Add Title
                    </button>
                )}
            </div>

            {/* Subtitle */}
            <div data-field="subtitle">
                {safeData.subtitle !== null && safeData.subtitle !== undefined ? (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <label className={labelClass}>Subtitle</label>
                            <button type="button" onClick={() => handleChange('subtitle', null)}
                                className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>
                        <input type="text" value={safeData.subtitle || ''} onChange={(e) => handleChange('subtitle', e.target.value)}
                            className={inputClass} placeholder="Brief description or tagline" />
                        <div className="flex gap-1 p-1 mt-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                            {[{ value: 'normal', label: 'Normal' }, { value: 'medium', label: 'Medium' }, { value: 'semibold', label: 'Semibold' }, { value: 'bold', label: 'Bold' }].map(({ value, label }) => (
                                <button key={value} type="button" onClick={() => handleChange('subtitleWeight', value)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        (safeData.subtitleWeight || 'medium') === value
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1">
                                <ColorInput value={safeData.subtitleColor} resolvedValue={resolvedSubtitleColor} onChange={(hex) => handleChange('subtitleColor', hex)}
                                    onClear={() => handleChange('subtitleColor', null)} label="Subtitle Color" />
                            </div>
                            {alignBtns('subtitleAlign')}
                        </div>
                    </>
                ) : (
                    <button type="button" onClick={() => handleChange('subtitle', '')}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-colors">
                        <Plus size={13} />
                        Add Subtitle
                    </button>
                )}
            </div>

            {/* CTA Buttons */}
            <div data-field="buttons">
                <label className={labelClass}>Buttons</label>
                <div className="space-y-2">

                    {/* Primary Button */}
                    {primaryBtn ? (
                        <div className={sectionClass}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Primary</span>
                                <button type="button" onClick={() => handleChange('primaryBtn', null)}
                                    className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            <input type="text" value={primaryBtn.label || ''} placeholder="Button label"
                                onChange={(e) => handleChange('primaryBtn', { ...primaryBtn, label: e.target.value })}
                                className={inputClass} />
                            <div className="flex gap-1 mt-1">
                                {(['page', 'form', 'url'] as const).map(t => (
                                    <button key={t} type="button"
                                        onClick={() => handleChange('primaryBtn', { ...primaryBtn, type: t, url: '', pageId: null, formId: null })}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                            (primaryBtn.type || 'url') === t
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                        }`}>
                                        {t === 'url' ? 'URL' : t}
                                    </button>
                                ))}
                            </div>
                            {primaryBtn.type === 'form' ? (
                                <SelectMenu
                                    value={primaryBtn.formId || ''}
                                    placeholder="— Select Form —"
                                    options={forms.map(f => ({ value: f.id, label: f.title || 'Untitled' }))}
                                    onChange={(formId) => handleChange('primaryBtn', { ...primaryBtn, formId: formId || null })}
                                />
                            ) : primaryBtn.type === 'page' ? (
                                <SelectMenu
                                    value={primaryBtn.pageId || ''}
                                    placeholder="— Select Page —"
                                    options={pages.map(p => ({ value: p.id, label: p.title || 'Untitled', hint: `/${p.slug}` }))}
                                    onChange={(pageId) => {
                                        const page = pages.find(p => p.id === pageId);
                                        handleChange('primaryBtn', { ...primaryBtn, pageId: pageId || null, url: page ? `/${page.slug}` : '' });
                                    }}
                                />
                            ) : (
                                <input type="text" value={primaryBtn.url || ''} placeholder="https://... or /page"
                                    onChange={(e) => handleChange('primaryBtn', { ...primaryBtn, url: e.target.value })}
                                    className={inputClass} />
                            )}
                        </div>
                    ) : (
                        <button type="button" onClick={() => handleChange('primaryBtn', { label: 'Get Started', url: '' })}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-blue-400 hover:border-blue-500/50 transition-all">
                            <Plus size={13} /> Add Primary Button
                        </button>
                    )}

                    {/* Secondary Button — only show add option once primary exists, but always show if it already exists */}
                    {(primaryBtn || secondaryBtn) && (
                        secondaryBtn ? (
                            <div className={sectionClass}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Secondary</span>
                                    <button type="button" onClick={() => handleChange('secondaryBtn', null)}
                                        className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                <input type="text" value={secondaryBtn.label || ''} placeholder="Button label"
                                    onChange={(e) => handleChange('secondaryBtn', { ...secondaryBtn, label: e.target.value })}
                                    className={inputClass} />
                                <div className="flex gap-1 mt-1">
                                    {(['page', 'form', 'url'] as const).map(t => (
                                        <button key={t} type="button"
                                            onClick={() => handleChange('secondaryBtn', { ...secondaryBtn, type: t, url: '', pageId: null, formId: null })}
                                            className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                                (secondaryBtn.type || 'url') === t
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                            }`}>
                                            {t === 'url' ? 'URL' : t}
                                        </button>
                                    ))}
                                </div>
                                {secondaryBtn.type === 'form' ? (
                                    <SelectMenu
                                        value={secondaryBtn.formId || ''}
                                        placeholder="— Select Form —"
                                        options={forms.map(f => ({ value: f.id, label: f.title || 'Untitled' }))}
                                        onChange={(formId) => handleChange('secondaryBtn', { ...secondaryBtn, formId: formId || null })}
                                    />
                                ) : secondaryBtn.type === 'page' ? (
                                    <SelectMenu
                                        value={secondaryBtn.pageId || ''}
                                        placeholder="— Select Page —"
                                        options={pages.map(p => ({ value: p.id, label: p.title || 'Untitled', hint: `/${p.slug}` }))}
                                        onChange={(pageId) => {
                                            const page = pages.find(p => p.id === pageId);
                                            handleChange('secondaryBtn', { ...secondaryBtn, pageId: pageId || null, url: page ? `/${page.slug}` : '' });
                                        }}
                                    />
                                ) : (
                                    <input type="text" value={secondaryBtn.url || ''} placeholder="https://... or /page"
                                        onChange={(e) => handleChange('secondaryBtn', { ...secondaryBtn, url: e.target.value })}
                                        className={inputClass} />
                                )}
                            </div>
                        ) : (
                            <button type="button" onClick={() => handleChange('secondaryBtn', { label: 'Learn More', url: '' })}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-600 transition-all">
                                <Plus size={13} /> Add Secondary Button
                            </button>
                        )
                    )}

                    {/* Button alignment */}
                    <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                        {([
                            { value: 'left',   icon: AlignStartVertical,   label: 'Left' },
                            { value: 'center', icon: AlignCenterVertical, label: 'Center' },
                            { value: 'right',  icon: AlignEndVertical,  label: 'Right' },
                        ] as const).map(({ value, icon: Icon, label }) => (
                            <button key={value} type="button" title={label}
                                onClick={() => handleChange('ctaAlign', value)}
                                className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${
                                    (safeData.ctaAlign ?? safeData.textAlign ?? 'left') === value
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                }`}>
                                <Icon size={15} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};
