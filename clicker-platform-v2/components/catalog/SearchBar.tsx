'use client';

import { Search, X } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
    const { theme } = useTemplate();

    return (
        <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <Search size={20} strokeWidth={2.5} />
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search for treats..."
                className="w-full pl-12 pr-12 py-4 rounded-xl border-[2px] border-white/50 bg-white/20 focus:bg-white outline-none font-bold text-lg placeholder:text-gray-600 transition-all shadow-sm"
                style={{
                    color: theme.colors.foreground,
                    // We can't easily do pseudo-classes like focus:border-brand-dark with inline styles without a wrapper or CSS-in-JS.
                    // But we can set a CSS variable or use the 'accent' color via a class if we had dynamic classes.
                    // For now, let's stick to the clean look or use a style tag approach if needed.
                    // Actually, we can use the `style` prop for the basic colors that need overrides.
                }}
            />

            {/* Dynamic Style Block for Focus State */}
            <style jsx>{`
                input:focus {
                    border-color: ${theme.colors.primary} !important;
                    color: ${theme.colors.foreground};
                }
            `}</style>

            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}
