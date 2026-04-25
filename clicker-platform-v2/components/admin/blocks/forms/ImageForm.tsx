'use client';

import { MediaField } from '../media-field/MediaField';
import { MediaFieldValue, DEFAULT_MEDIA } from '../media-field/types';

interface ImageFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const ImageForm = ({ data, onChange }: ImageFormProps) => {
    const safeData = data || {};

    // Migrate legacy url-only data to MediaFieldValue shape
    const mediaValue: MediaFieldValue = safeData.media ?? (
        safeData.url ? { ...DEFAULT_MEDIA, type: 'image', src: safeData.url } : DEFAULT_MEDIA
    );

    return (
        <div className="space-y-4">
            <MediaField
                value={mediaValue}
                onChange={(media) => {
                    const next = { ...safeData, media };
                    delete next.url;
                    onChange(next);
                }}
            />
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1.5">Caption</label>
                <input
                    type="text"
                    value={safeData.caption || ''}
                    onChange={(e) => {
                        const next = { ...safeData, caption: e.target.value };
                        delete next.url;
                        onChange(next);
                    }}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600"
                    placeholder="Optional caption"
                />
            </div>
        </div>
    );
};
