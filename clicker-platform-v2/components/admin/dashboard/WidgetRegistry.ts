import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const PosWidget = dynamic(() => import('./widgets/PosWidget').then(m => m.PosWidget));
const ReservationWidget = dynamic(() => import('./widgets/ReservationWidget').then(m => m.ReservationWidget));
const MembershipWidget = dynamic(() => import('./widgets/MembershipWidget').then(m => m.MembershipWidget));
const InventoryWidget = dynamic(() => import('./widgets/InventoryWidget').then(m => m.InventoryWidget));
const PromoWidget = dynamic(() => import('./widgets/PromoWidget').then(m => m.PromoWidget));
const ServiceRecordsWidget = dynamic(() => import('./widgets/ServiceRecordsWidget').then(m => m.ServiceRecordsWidget));
const SalesPipelineWidget = dynamic(() => import('./widgets/SalesPipelineWidget').then(m => m.SalesPipelineWidget));
const FintrackWidget = dynamic(() => import('./widgets/FintrackWidget').then(m => m.FintrackWidget));

export const WIDGET_REGISTRY: Record<string, ComponentType<{ siteId: string }>> = {
  'byod_pos:DashboardWidget': PosWidget,
  'reservation:DashboardWidget': ReservationWidget,
  'membership:DashboardWidget': MembershipWidget,
  'inventory:DashboardWidget': InventoryWidget,
  'promo:DashboardWidget': PromoWidget,
  'service_records:DashboardWidget': ServiceRecordsWidget,
  'sales_pipeline:DashboardWidget': SalesPipelineWidget,
  'fintrack:DashboardWidget': FintrackWidget,
};
