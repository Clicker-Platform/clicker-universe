import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Lazy load the editor to avoid bloating the admin bundle
const RichTextEditor = dynamic(
    () => import('../rich-text/RichTextEditor').then(mod => mod.RichTextEditor),
    {
        loading: () => (
            <div className="h-[200px] w-full bg-gray-50 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 gap-2">
                <Loader2 className="animate-spin" size={20} />
                <span>Loading Editor...</span>
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
    return (
        <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500">Content</label>
            <div className="min-h-[200px]">
                <RichTextEditor
                    value={data.content || ''}
                    onChange={(html) => onChange({ ...data, content: html })}
                />
            </div>
            <p className="text-[10px] text-gray-400">
                Type '/' for quick actions. Supports rich text and images.
            </p>
        </div>
    );
};
