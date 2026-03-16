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
                <label className="block text-xs font-medium text-neutral-500 mb-2">Button Text</label>
                <input
                    type="text"
                    value={safeData.label || ''}
                    onChange={(e) => handleChange('label', e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                    placeholder="Click Here"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-medium text-neutral-500 mb-2">Target URL</label>
                <input
                    type="text"
                    value={safeData.url || ''}
                    onChange={(e) => handleChange('url', e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                    placeholder="https://..."
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Style</label>
                <select
                    value={safeData.variant || 'primary'}
                    onChange={(e) => handleChange('variant', e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium appearance-none cursor-pointer"
                >
                    <option value="primary">Solid (Brand)</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Alignment</label>
                <select
                    value={safeData.align || 'center'}
                    onChange={(e) => handleChange('align', e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium appearance-none cursor-pointer"
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
