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
        </div>
    );
};
