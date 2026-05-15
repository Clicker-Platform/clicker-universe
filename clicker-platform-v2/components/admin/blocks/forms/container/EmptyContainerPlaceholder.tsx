import { Columns3, LayoutGrid } from 'lucide-react';

interface EmptyContainerPlaceholderProps {
  type: 'columns' | 'grid';
}

const ICONS = {
  columns: Columns3,
  grid: LayoutGrid,
};

const LABELS = {
  columns: 'Empty Columns',
  grid: 'Empty Grid',
};

export function EmptyContainerPlaceholder({ type }: EmptyContainerPlaceholderProps) {
  const Icon = ICONS[type];
  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500">
      <Icon size={28} />
      <div className="text-sm font-medium">{LABELS[type]}</div>
      <div className="text-xs">Add blocks from the side panel</div>
    </div>
  );
}
