export interface ModuleCatalogEntry {
  id: string;
  name: string;
  description: string;
}

export const MODULES_CATALOG: ModuleCatalogEntry[] = [
  {
    id: 'byod_pos',
    name: 'Self Order POS',
    description: 'Cashier, KDS, transactions, menu, and reports.',
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Stock management with audit trails.',
  },
  {
    id: 'reservation',
    name: 'Reservation',
    description: 'Booking and scheduling for services.',
  },
  {
    id: 'membership',
    name: 'Membership',
    description: 'Loyalty program and member profiles.',
  },
  {
    id: 'promo',
    name: 'Promo Engine',
    description: 'Discount codes, vouchers, and auto-apply rules.',
  },
  {
    id: 'service_records',
    name: 'Service Records',
    description: 'Vehicle service history, warranty, and reminders.',
  },
  {
    id: 'sales_pipeline',
    name: 'Sales Pipeline',
    description: 'CRM Kanban board for leads and deals.',
  },
  {
    id: 'ai_sales',
    name: 'AI Sales Agent',
    description: 'Gemini-powered chatbot and lead capture.',
  },
  {
    id: 'ai_marketing',
    name: 'AI Marketing',
    description: 'AI-assisted marketing campaigns and content.',
  },
];
