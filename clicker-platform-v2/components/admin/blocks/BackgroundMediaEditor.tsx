'use client';

import { BackgroundMedia } from '@/data/mockData';
import { CompactImageUpload } from '@/components/admin/CompactImageUpload';

interface BackgroundMediaEditorProps {
    value?: BackgroundMedia;
    onChange: (val: BackgroundMedia) => void;
    allowInherit?: boolean; // If true, shows 'inherit' mode
}

export function BackgroundMediaEditor({ value, onChange, allowInherit }: BackgroundMediaEditorProps) {
    const bg = value || { mode: allowInherit ? 'inherit' : 'color' };
    const mode = bg.mode || (allowInherit ? 'inherit' : 'color');

    const update = (patch: Partial<BackgroundMedia>) => {
        onChange({ ...bg, ...patch } as BackgroundMedia);
    };

    const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
    const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

    return (
        <div className="space-y-4">
            <div>
                <label className={labelClass}>Background Type</label>
                <select
                    value={mode}
                    onChange={(e) => update({ mode: e.target.value as any })}
                    className={inputClass}
                >
                    {allowInherit && <option value="inherit">Inherit Global Background</option>}
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
                            value={bg.color || '#ffffff'}
                            onChange={(e) => update({ color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                            type="text"
                            value={bg.color || '#ffffff'}
                            onChange={(e) => update({ color: e.target.value })}
                            className={inputClass}
                            placeholder="#ffffff"
                        />
                    </div>
                </div>
            )}

            {mode === 'image' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Upload Image</label>
                        <CompactImageUpload
                            currentUrl={bg.url}
                            onUpload={(url) => update({ url })}
                            onRemove={() => update({ url: '' })}
                            label="Background Image"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Position</label>
                        {(() => {
                            const positions = [
                                'top left', 'top center', 'top right',
                                'center left', 'center center', 'center right',
                                'bottom left', 'bottom center', 'bottom right',
                            ];
                            const current = bg.backgroundPosition || 'center center';
                            return (
                                <div className="grid grid-cols-3 gap-1 w-24">
                                    {positions.map((pos) => {
                                        const isActive = current === pos || (pos === 'center center' && current === 'center');
                                        return (
                                            <button
                                                key={pos}
                                                type="button"
                                                title={pos}
                                                onClick={() => update({ backgroundPosition: pos })}
                                                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isActive
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600'
                                                }`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-neutral-400 dark:bg-neutral-400'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                    <div>
                        <label className={labelClass}>Display Size</label>
                        <select
                            value={bg.displaySize || 'cover'}
                            onChange={(e) => update({ displaySize: e.target.value as any })}
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
                            value={bg.scrollEffect || 'scroll'}
                            onChange={(e) => update({ scrollEffect: e.target.value as any })}
                            className={inputClass}
                        >
                            <option value="scroll">Normal Scroll</option>
                            <option value="fixed">Fixed (Parallax effect)</option>
                        </select>
                    </div>
                </div>
            )}

            {mode === 'video' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Video URL</label>
                        <input
                            type="text"
                            value={bg.url || ''}
                            onChange={(e) => update({ url: e.target.value })}
                            className={inputClass}
                            placeholder="https://youtube.com/... or .mp4"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">Supports YouTube, Vimeo, or raw .mp4 links. Videos will autoplay silently behind your content.</p>
                    </div>
                </div>
            )}

            {(mode === 'image' || mode === 'video') && (
                <div className="pt-2 border-t border-gray-200 dark:border-neutral-800">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">Overlay</label>
                    <p className="text-[10px] text-neutral-500 mb-2">Add a dark or light wash over the media to make text readable.</p>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={bg.overlayColor || '#000000'}
                                onChange={(e) => update({ overlayColor: e.target.value })}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                            />
                            <div className="flex-1 flex items-center gap-2">
                                <span className="text-[10px] text-neutral-500 w-12 text-right">Opacity:</span>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={(bg.overlayOpacity ?? 0.5) * 100}
                                    onChange={(e) => update({ overlayOpacity: parseInt(e.target.value) / 100 })}
                                    className="flex-1 accent-blue-500"
                                />
                                <span className="text-[10px] text-neutral-700 dark:text-neutral-300 w-8">{Math.round((bg.overlayOpacity ?? 0.5) * 100)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
