'use client';

import { BlockImageUploader } from '../BlockImageUploader';

interface ImageFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const ImageForm = ({ data, onChange }: ImageFormProps) => {
    const safeData = data || {};

    const handleChange = (field: string, value: string) => {
        onChange({ ...safeData, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div>
                <BlockImageUploader
                    label="Upload Image"
                    currentUrl={safeData.url}
                    onUpload={(url) => handleChange('url', url)}
                    onRemove={() => handleChange('url', '')}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1.5">Caption</label>
                <input
                    type="text"
                    value={safeData.caption || ''}
                    onChange={(e) => handleChange('caption', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600"
                    placeholder="Optional image caption"
                />
            </div>
        </div>
    );
};
