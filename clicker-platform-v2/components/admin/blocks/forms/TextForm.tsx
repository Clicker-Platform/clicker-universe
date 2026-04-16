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

interface TextFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const TextForm = ({ data, onChange }: TextFormProps) => {
    const safeData = data || {};
    return (
        <div className="space-y-4">
            <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500">Content</label>
            <div className="min-h-[200px] rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800 bg-gray-100/50 dark:bg-neutral-900/50">
                <RichTextEditor
                    value={safeData.content || ''}
                    onChange={(html) => onChange({ ...safeData, content: html })}
                />
            </div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-neutral-700" />
                Type <kbd className="bg-gray-100 dark:bg-neutral-800 px-1 rounded border border-gray-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono">/</kbd> for quick actions. Supports rich text and images.
            </p>
        </div>
    );
};
