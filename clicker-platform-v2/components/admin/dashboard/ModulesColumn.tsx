'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Plus, Box } from 'lucide-react';
import type { ModuleDefinition } from '@/lib/modules/types';
import { WIDGET_REGISTRY } from './WidgetRegistry';
import { AddModuleWidgetPicker } from './AddModuleWidgetPicker';
import { setVisibleWidgets } from '@/lib/modules/dashboard-overview';
import { useUser } from '@/lib/user-context';

interface Props {
  siteId: string;
  baseUrl: string;
  enabledModules: ModuleDefinition[];
  visibleIds: string[];
}

export function ModulesColumn({ siteId, baseUrl, enabledModules, visibleIds }: Props) {
  const { role } = useUser();
  const canCustomize = role === 'owner' || role === 'editor';

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchor = useRef<HTMLDivElement>(null);

  const moduleById = useMemo(() => {
    const map = new Map<string, ModuleDefinition>();
    enabledModules.forEach(m => map.set(m.id, m));
    return map;
  }, [enabledModules]);

  const candidates = useMemo(
    () => enabledModules.filter(m => m.adminDashboardWidget?.componentKey),
    [enabledModules],
  );

  const handleSave = async (ids: string[]) => {
    await setVisibleWidgets(siteId, ids);
  };

  const handleRemove = async (id: string) => {
    await setVisibleWidgets(siteId, visibleIds.filter(x => x !== id));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Box className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-800 dark:text-neutral-100">Modules</h2>
      </div>

      <div className="space-y-2">
        {visibleIds.map(id => {
          const mod = moduleById.get(id);
          if (!mod) return null;
          const key = mod.adminDashboardWidget?.componentKey;
          const Widget = key ? WIDGET_REGISTRY[key] : null;
          const href = mod.dashboardAction?.href
            ? `${baseUrl}${mod.dashboardAction.href}`
            : `${baseUrl}/admin`;

          return (
            <div
              key={id}
              className="group relative rounded border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/40 p-3 hover:border-gray-300"
            >
              {canCustomize && (
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    handleRemove(id);
                  }}
                  aria-label={`Remove ${mod.displayName}`}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 z-10"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
              <Link href={href} className="block">
                {Widget ? (
                  <Widget siteId={siteId} />
                ) : (
                  <p className="text-xs text-gray-400">No data</p>
                )}
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  {mod.displayName}
                </p>
              </Link>
            </div>
          );
        })}

        {visibleIds.length === 0 && canCustomize && (
          <p className="text-xs text-gray-400 dark:text-neutral-500 px-1 py-2">
            Pick which modules to show here.
          </p>
        )}

        {canCustomize && (
          <div ref={pickerAnchor} className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen(o => !o)}
              className="w-full border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded p-3 text-xs text-gray-500 hover:border-gray-400 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add module
            </button>
            <AddModuleWidgetPicker
              open={pickerOpen}
              candidates={candidates}
              currentVisible={visibleIds}
              onSave={handleSave}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
