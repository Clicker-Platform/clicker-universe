'use client';

interface ProductGridBlockFormProps {
    data: any;
    onChange: (data: any) => void;
}

const inputClass = "w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

const COLUMN_OPTIONS = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
] as const;

const MOBILE_LAYOUT_OPTIONS = [
    { value: 'stack', label: 'Stack' },
    { value: 'scroll', label: 'Horizontal scroll' },
] as const;

export function ProductGridBlockForm({ data, onChange }: ProductGridBlockFormProps) {
    const safe = data || {};
    const set = (field: string, value: any) => onChange({ ...safe, [field]: value });

    return (
        <div className="space-y-4">

            {/* Title */}
            <div>
                <label className={labelClass}>Section Title</label>
                <input
                    type="text"
                    value={safe.title || ''}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="Store"
                    className={inputClass}
                />
            </div>

            {/* Subtitle */}
            <div>
                <label className={labelClass}>Subtitle</label>
                <input
                    type="text"
                    value={safe.subtitle || ''}
                    onChange={(e) => set('subtitle', e.target.value)}
                    placeholder="Browse and buy digital products."
                    className={inputClass}
                />
            </div>

            {/* Columns */}
            <div>
                <label className={labelClass}>Columns</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {COLUMN_OPTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => set('columns', value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                (safe.columns ?? 3) === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile Layout */}
            <div>
                <label className={labelClass}>Mobile Layout</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {MOBILE_LAYOUT_OPTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => set('mobileLayout', value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                (safe.mobileLayout ?? 'stack') === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                    Stack follows viewport breakpoints. Horizontal scroll shows ~70% width cards with peek.
                </p>
            </div>

            {/* Limit */}
            <div>
                <label className={labelClass}>Max Products Shown</label>
                <input
                    type="number"
                    min={1}
                    max={48}
                    value={safe.limit ?? 12}
                    onChange={(e) => set('limit', Number(e.target.value))}
                    className={inputClass}
                />
            </div>

            {/* Vertical Spacing */}
            <div>
                <label className={labelClass}>Vertical Spacing</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['none', 'small', 'medium', 'tall'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('verticalSpacing', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safe.verticalSpacing || 'medium') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'none' ? 'None' : v === 'small' ? 'Small' : v === 'medium' ? 'Medium' : 'Tall'}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
}
