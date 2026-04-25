interface StatItem {
    label: string;
    value: string | number;
    variant?: 'default' | 'red' | 'green' | 'amber';
}

interface StatsGridProps {
    items: StatItem[];
    cols?: 2 | 3 | 4;
}

const variantClass: Record<string, string> = {
    default: 'text-brand-dark',
    red: 'text-red-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
};

export default function StatsGrid({ items, cols = 3 }: StatsGridProps) {
    const gridClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
    }[cols];

    return (
        <div className={`grid ${gridClass} gap-4 mb-6`}>
            {items.map((item, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`text-2xl font-black ${variantClass[item.variant ?? 'default']}`}>{item.value}</p>
                </div>
            ))}
        </div>
    );
}
