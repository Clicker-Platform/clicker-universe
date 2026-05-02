import { ModuleDefinition } from '@/lib/modules/types';

interface Connection {
  from: string;
  to: string;
  label: string;
}

const ALL_CONNECTIONS: Connection[] = [
  { from: 'byod_pos', to: 'inventory', label: 'deducts stock' },
  { from: 'byod_pos', to: 'membership', label: 'awards points' },
  { from: 'byod_pos', to: 'promo', label: 'applies discounts' },
  { from: 'reservation', to: 'membership', label: 'linked to' },
  { from: 'service_records', to: 'membership', label: 'linked to' },
  { from: 'service_records', to: 'inventory', label: 'deducts parts' },
];

interface Props {
  activeModules: ModuleDefinition[];
}

export function ModuleConnectionMap({ activeModules }: Props) {
  const activeIds = new Set(activeModules.map(m => m.id));
  const visibleConnections = ALL_CONNECTIONS.filter(
    c => activeIds.has(c.from) && activeIds.has(c.to)
  );

  if (visibleConnections.length === 0) return null;

  const nameFor = (id: string) =>
    activeModules.find(m => m.id === id)?.displayName ?? id;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-3">
        Module Connections
      </h2>
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {visibleConnections.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 font-medium px-2.5 py-1 rounded-md text-xs">
                {nameFor(c.from)}
              </span>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400 dark:text-neutral-500 leading-none mb-0.5">
                  {c.label}
                </span>
                <span className="text-gray-300 dark:text-neutral-600">→</span>
              </div>
              <span className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 font-medium px-2.5 py-1 rounded-md text-xs">
                {nameFor(c.to)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
