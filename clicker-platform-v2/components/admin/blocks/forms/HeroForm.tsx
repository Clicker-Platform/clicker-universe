'use client';

import { BlockImageUploader } from '../BlockImageUploader';

interface HeroFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const HeroForm = ({ data, onChange }: HeroFormProps) => {
    const safeData = data || {};

    const handleChange = (field: string, value: string) => {
        onChange({ ...safeData, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Title</label>
                <input
                    type="text"
                    value={safeData.title || ''}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-brand-dark focus:ring-0"
                    placeholder="Welcome to our page"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Subtitle</label>
                <input
                    type="text"
                    value={safeData.subtitle || ''}
                    onChange={(e) => handleChange('subtitle', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-brand-dark focus:ring-0"
                    placeholder="Brief description or tagline"
                />
            </div>
            <div>
                <BlockImageUploader
                    label="Hero Image"
                    currentUrl={safeData.imageUrl}
                    onUpload={(url) => handleChange('imageUrl', url)}
                    onRemove={() => handleChange('imageUrl', '')}
                />
            </div>
        </div>
    );
};
