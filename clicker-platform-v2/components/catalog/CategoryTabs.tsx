'use client';

import { useTemplate } from '@/components/TemplateProvider';
interface CategoryTabsProps {
    categories: string[];
    selectedCategory: string;
    onSelect: (category: string) => void;
}

export function CategoryTabs({ categories, selectedCategory, onSelect }: CategoryTabsProps) {
    const { theme } = useTemplate();

    return (
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {categories.map((category) => {
                const isSelected = selectedCategory === category;

                const activeStyle = {
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background, // Contrast text
                    borderColor: theme.colors.primary
                };

                return (
                    <button
                        key={category}
                        onClick={() => onSelect(category)}
                        className={`
                            px-6 py-3 rounded-full font-bold whitespace-nowrap transition-all border-[2px] shrink-0
                            ${isSelected
                                ? 'shadow-sm'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                            }
                        `}
                        style={isSelected ? activeStyle : {}}
                    >
                        {category}
                    </button>
                );
            })}
        </div>
    );
}
