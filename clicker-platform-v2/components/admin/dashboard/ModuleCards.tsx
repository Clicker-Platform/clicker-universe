'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ModuleDefinition } from '@/lib/modules/types';

const PosWidget = dynamic(() => import('./widgets/PosWidget').then(m => m.PosWidget));
const ReservationWidget = dynamic(() => import('./widgets/ReservationWidget').then(m => m.ReservationWidget));
const MembershipWidget = dynamic(() => import('./widgets/MembershipWidget').then(m => m.MembershipWidget));
const InventoryWidget = dynamic(() => import('./widgets/InventoryWidget').then(m => m.InventoryWidget));
const PromoWidget = dynamic(() => import('./widgets/PromoWidget').then(m => m.PromoWidget));
const ServiceRecordsWidget = dynamic(() => import('./widgets/ServiceRecordsWidget').then(m => m.ServiceRecordsWidget));
const SalesPipelineWidget = dynamic(() => import('./widgets/SalesPipelineWidget').then(m => m.SalesPipelineWidget));
const FintrackWidget = dynamic(() => import('./widgets/FintrackWidget').then(m => m.FintrackWidget));

const WIDGET_REGISTRY: Record<string, React.ComponentType<{ siteId: string }>> = {
  'byod_pos:DashboardWidget': PosWidget,
  'reservation:DashboardWidget': ReservationWidget,
  'membership:DashboardWidget': MembershipWidget,
  'inventory:DashboardWidget': InventoryWidget,
  'promo:DashboardWidget': PromoWidget,
  'service_records:DashboardWidget': ServiceRecordsWidget,
  'sales_pipeline:DashboardWidget': SalesPipelineWidget,
  'fintrack:DashboardWidget': FintrackWidget,
};

const CARD_COLORS: Record<string, string> = {
  byod_pos: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
  reservation: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
  membership: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
  inventory: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
  promo: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
  service_records: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  sales_pipeline: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
  fintrack: 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800',
};

const BUTTON_COLORS: Record<string, string> = {
  byod_pos: 'bg-green-600 hover:bg-green-700',
  reservation: 'bg-blue-600 hover:bg-blue-700',
  membership: 'bg-purple-600 hover:bg-purple-700',
  inventory: 'bg-orange-600 hover:bg-orange-700',
  promo: 'bg-green-600 hover:bg-green-700',
  service_records: 'bg-yellow-600 hover:bg-yellow-700',
  sales_pipeline: 'bg-indigo-600 hover:bg-indigo-700',
  fintrack: 'bg-teal-600 hover:bg-teal-700',
};

interface Props {
  activeModules: ModuleDefinition[];
  siteId: string;
  baseUrl: string;
}

export function ModuleCards({ activeModules, siteId, baseUrl }: Props) {
  const modulesWithActions = activeModules.filter(m => m.dashboardAction);

  if (modulesWithActions.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-3">
        Active Modules
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modulesWithActions.map(m => {
          const cardColor = CARD_COLORS[m.id] ?? 'bg-gray-50 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800';
          const btnColor = BUTTON_COLORS[m.id] ?? 'bg-gray-600 hover:bg-gray-700';
          const WidgetComponent = m.adminDashboardWidget
            ? WIDGET_REGISTRY[m.adminDashboardWidget.componentKey]
            : null;

          return (
            <div key={m.id} className={`border rounded-lg p-3.5 ${cardColor}`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                  {m.displayName}
                </span>
                {m.dashboardAction && (
                  <Link
                    href={`${baseUrl}${m.dashboardAction.href}`}
                    className={`${btnColor} text-white text-[10px] font-semibold px-2.5 py-1 rounded transition-colors`}
                  >
                    {m.dashboardAction.label}
                  </Link>
                )}
              </div>
              {WidgetComponent ? (
                <WidgetComponent siteId={siteId} />
              ) : (
                <p className="text-xs text-gray-400 dark:text-neutral-500">No data available</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
