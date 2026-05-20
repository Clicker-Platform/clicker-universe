'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { BackgroundMedia, BackgroundMediaBase } from '@/data/mockData';
import { MediaPicker } from '@/components/admin/media/MediaPicker';

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";
const sectionClass = "pt-2 border-t border-gray-200 dark:border-neutral-800";
const sectionTitleClass = "block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-3 uppercase tracking-wider";

function PositionGrid({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
    const positions = [
        'top left', 'top center', 'top right',
        'center left', 'center center', 'center right',
        'bottom left', 'bottom center', 'bottom right',
    ];
    const current = value || 'center center';
    return (
        <div className="grid grid-cols-3 gap-1 w-24">
            {positions.map((pos) => {
                const isActive = current === pos || (pos === 'center center' && current === 'center');
                return (
                    <button
                        key={pos}
                        type="button"
                        title={pos}
                        onClick={() => onChange(pos)}
                        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isActive
                            ? 'bg-blue-500'
                            : 'bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600'
                        }`}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-neutral-400'}`} />
                    </button>
                );
            })}
        </div>
    );
}

function OverlayEditor({ value, onChange }: { value: BackgroundMediaBase; onChange: (patch: Partial<BackgroundMediaBase>) => void }) {
    return (
        <div className={sectionClass}>
            <label className={sectionTitleClass}>Overlay</label>
            <p className="text-[10px] text-neutral-500 mb-2">Add a dark or light wash over the media to make text readable.</p>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value.overlayColor || '#000000'}
                    onChange={(e) => onChange({ overlayColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <div className="flex-1 flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 w-12 text-right">Opacity:</span>
                    <input
                        type="range"
                        min="0" max="100"
                        value={(value.overlayOpacity ?? 0) * 100}
                        onChange={(e) => onChange({ overlayOpacity: parseInt(e.target.value) / 100 })}
                        className="flex-1 accent-blue-500"
                    />
                    <span className="text-[10px] text-neutral-700 dark:text-neutral-300 w-8">{Math.round((value.overlayOpacity ?? 0) * 100)}%</span>
                </div>
            </div>
        </div>
    );
}

// Shared fields editor for a BackgroundMediaBase — used for both desktop and mobile
function BackgroundBaseEditor({
    value,
    onChange,
    allowInherit,
    inheritLabel = 'Same as desktop',
}: {
    value: BackgroundMediaBase;
    onChange: (patch: Partial<BackgroundMediaBase>) => void;
    allowInherit?: boolean;
    inheritLabel?: string;
}) {
    const mode = value.mode;
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="space-y-4">
            <div>
                <label className={labelClass}>Background Type</label>
                <select
                    value={mode}
                    onChange={(e) => onChange({ mode: e.target.value as BackgroundMediaBase['mode'] })}
                    className={inputClass}
                >
                    {allowInherit && <option value="inherit">{inheritLabel}</option>}
                    <option value="color">Solid Color</option>
                    <option value="image">Image</option>
                    <option value="video">Video URL (YouTube/Vimeo/MP4)</option>
                </select>
            </div>

            {mode === 'color' && (
                <div>
                    <label className={labelClass}>Background Color</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={value.color || '#ffffff'}
                            onChange={(e) => onChange({ color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                            type="text"
                            value={value.color || '#ffffff'}
                            onChange={(e) => onChange({ color: e.target.value })}
                            className={inputClass}
                            placeholder="#ffffff"
                        />
                    </div>
                </div>
            )}

            {mode === 'image' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Background Image</label>
                        {value.url ? (
                            <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-800 rounded-lg group hover:border-blue-500/30 transition-colors">
                                <div className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 overflow-hidden flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={value.url} alt="Background preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 dark:text-neutral-400 truncate font-medium">{value.url.split('/').pop() || 'image'}</p>
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen(true)}
                                        className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                    >
                                        Change Image
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onChange({ url: '' })}
                                    className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Remove Image"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setPickerOpen(true)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 font-bold hover:border-blue-500/50 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all text-sm"
                            >
                                <Upload size={18} />
                                <span>Upload Image</span>
                            </button>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Position</label>
                        <PositionGrid value={value.backgroundPosition} onChange={(v) => onChange({ backgroundPosition: v })} />
                    </div>
                    <div>
                        <label className={labelClass}>Display Size</label>
                        <select
                            value={value.displaySize || 'cover'}
                            onChange={(e) => onChange({ displaySize: e.target.value as BackgroundMediaBase['displaySize'] })}
                            className={inputClass}
                        >
                            <option value="cover">Cover (Fill screen)</option>
                            <option value="contain">Contain (Fit inside)</option>
                            <option value="pattern">Pattern (Repeat)</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Scroll Effect</label>
                        <select
                            value={value.scrollEffect || 'scroll'}
                            onChange={(e) => onChange({ scrollEffect: e.target.value as BackgroundMediaBase['scrollEffect'] })}
                            className={inputClass}
                        >
                            <option value="scroll">Normal Scroll</option>
                            <option value="fixed">Fixed (Parallax effect)</option>
                        </select>
                    </div>
                    <OverlayEditor value={value} onChange={onChange} />

                    <MediaPicker
                        open={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        onSelect={({ url }) => { onChange({ url }); setPickerOpen(false); }}
                        accept="image"
                    />
                </div>
            )}

            {mode === 'video' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Video URL</label>
                        <input
                            type="text"
                            value={value.url || ''}
                            onChange={(e) => onChange({ url: e.target.value })}
                            className={inputClass}
                            placeholder="https://youtube.com/... or .mp4"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">Supports YouTube, Vimeo, or raw .mp4 links. Videos will autoplay silently behind your content.</p>
                    </div>
                    <OverlayEditor value={value} onChange={onChange} />
                </div>
            )}
        </div>
    );
}

interface BackgroundMediaEditorProps {
    value?: BackgroundMedia;
    onChange: (val: BackgroundMedia) => void;
    allowInherit?: boolean;
}

export function BackgroundMediaEditor({ value, onChange, allowInherit }: BackgroundMediaEditorProps) {
    const bg: BackgroundMedia = value || { mode: allowInherit ? 'inherit' : 'color' };

    const updateDesktop = (patch: Partial<BackgroundMediaBase>) => {
        onChange({ ...bg, ...patch } as BackgroundMedia);
    };

    const updateMobile = (patch: Partial<BackgroundMediaBase>) => {
        const currentMobile = bg.mobile || { mode: 'inherit' };
        onChange({ ...bg, mobile: { ...currentMobile, ...patch } });
    };

    const desktopHasMedia = bg.mode === 'image' || bg.mode === 'video';

    return (
        <div className="space-y-4">
            {/* Desktop */}
            <BackgroundBaseEditor
                value={bg}
                onChange={updateDesktop}
                allowInherit={allowInherit}
                inheritLabel="Inherit Global Background"
            />

            {/* Mobile override — only shown when desktop has image/video */}
            {desktopHasMedia && (
                <div className={sectionClass}>
                    <label className={sectionTitleClass}>Mobile Override</label>
                    <p className="text-[10px] text-neutral-500 mb-3">
                        Customize how the background appears on small screens. Defaults to the same background above.
                    </p>
                    <BackgroundBaseEditor
                        value={bg.mobile || { mode: 'inherit' }}
                        onChange={updateMobile}
                        allowInherit
                        inheritLabel="Same as desktop"
                    />
                </div>
            )}
        </div>
    );
}
