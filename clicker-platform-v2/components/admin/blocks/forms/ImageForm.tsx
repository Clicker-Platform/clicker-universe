'use client';

import { BlockImageUploader } from '../BlockImageUploader';

interface ImageFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const ImageForm = ({ data, onChange }: ImageFormProps) => {
    const handleChange = (field: string, value: string) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div>
                <BlockImageUploader
                    label="Upload Image"
                    currentUrl={data.url}
                    onUpload={(url) => handleChange('url', url)}
                    onRemove={() => handleChange('url', '')}
                />
            </div>
        </div>
    );
};
