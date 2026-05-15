import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load the editor to avoid bloating the admin bundle
const RichTextEditor = dynamic(
    () => import('../rich-text/RichTextEditor').then(mod => mod.RichTextEditor),
    {
        loading: () => (
            <div className="h-[200px] w-full bg-gray-100/50 dark:bg-neutral-900/50 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 gap-3">
                <Loader2 className="animate-spin text-blue-500" size={24} />
                <span className="text-xs font-bold uppercase tracking-widest bg-gray-100 dark:bg-neutral-800 px-3 py-1 rounded-full border border-gray-200 dark:border-neutral-700">Loading Editor...</span>
            </div>
        ),
        ssr: false
    }
);

const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

interface TextFormProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

export const TextForm = ({ data, onChange }: TextFormProps) => {
    const safeData = data || {};
    const set = (field: string, value: unknown) => onChange({ ...safeData, [field]: value });

    return (
        <div className="space-y-4">
            <div>
                <label className={labelClass}>Content</label>
                <div className="min-h-[200px] rounded-lg overflow-hidden">
                    <RichTextEditor
                        value={(safeData.content as string | undefined) || ''}
                        onChange={(html) => set('content', html)}
                    />
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium flex items-center gap-1.5 mt-2">
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-neutral-700" />
                    Type <kbd className="bg-gray-100 dark:bg-neutral-800 px-1 rounded border border-gray-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono">/</kbd> for quick actions. Supports rich text and images.
                </p>
            </div>

            <div>
                <label className={labelClass}>Vertical Spacing</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['small', 'medium', 'tall'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('verticalSpacing', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safeData.verticalSpacing || 'medium') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'small' ? 'Small' : v === 'medium' ? 'Medium' : 'Tall'}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className={labelClass}>Horizontal Padding</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['none', 'normal', 'wide'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('horizontalPadding', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safeData.horizontalPadding || 'none') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'none' ? 'None' : v === 'normal' ? 'Normal' : 'Wide'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
