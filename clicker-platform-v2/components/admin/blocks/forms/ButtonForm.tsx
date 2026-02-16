'use client';

interface ButtonFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const ButtonForm = ({ data, onChange }: ButtonFormProps) => {
    const safeData = data || {};

    const handleChange = (field: string, value: string) => {
        onChange({ ...safeData, [field]: value });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Label</label>
                <input
                    type="text"
                    value={safeData.label || ''}
                    onChange={(e) => handleChange('label', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-brand-dark focus:ring-0"
                    placeholder="Click Here"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">URL</label>
                <input
                    type="text"
                    value={safeData.url || ''}
                    onChange={(e) => handleChange('url', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-brand-dark focus:ring-0 font-mono"
                    placeholder="https://..."
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Style</label>
                <select
                    value={safeData.variant || 'primary'}
                    onChange={(e) => handleChange('variant', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                    <option value="primary">Solid (Brand)</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Alignment</label>
                <select
                    value={safeData.align || 'center'}
                    onChange={(e) => handleChange('align', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="full">Full Width</option>
                </select>
            </div>
        </div>
    );
};
