
import { POSOrder } from '../byod_pos/types';

export interface ReportSummary {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    paymentBreakdown: Record<string, number>;
    cancelledOrders: number;
    cancelledValue: number;
}

/**
 * Calculates report summary from a list of orders.
 * Useful for client-side calculations or fallback when server-side stats are insufficient (e.g. payment breakdown).
 */
export function calculateReportSummary(orders: POSOrder[]): ReportSummary {
    const validOrders = orders.filter(o => o.status === 'completed' || o.status === 'ready' || (o.status as any) === 'served');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    const totalSales = validOrders.reduce((acc, o) => acc + o.total, 0);
    const totalOrders = validOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const paymentBreakdown: Record<string, number> = {};
    validOrders.forEach(o => {
        const method = o.paymentMethod || 'unknown';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + o.total;
    });

    return {
        totalSales,
        totalOrders,
        averageOrderValue,
        paymentBreakdown,
        cancelledOrders: cancelledOrders.length,
        cancelledValue: cancelledOrders.reduce((acc, o) => acc + o.total, 0)
    };
}

/**
 * Standard currency formatter for IDR.
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

export interface ItemSalesSummary {
    id: string; // Item ID or Name if no ID
    name: string;
    quantity: number;
    revenue: number;
    category?: string;
}

export function calculateItemsSales(orders: any[]): ItemSalesSummary[] {
    const map = new Map<string, ItemSalesSummary>();

    for (const order of orders) {
        if (!order.items || !Array.isArray(order.items)) continue;

        for (const item of order.items) {
            // Use ID if available, otherwise fallback to name as key
            const key = item.id || item.name;
            const existing = map.get(key);

            if (existing) {
                existing.quantity += (item.quantity || 1);
                existing.revenue += (item.price * (item.quantity || 1));
            } else {
                map.set(key, {
                    id: key,
                    name: item.name,
                    quantity: item.quantity || 1,
                    revenue: item.price * (item.quantity || 1),
                    category: item.category
                });
            }
        }
    }

    // Convert to array and sort by Quantity DESC
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
}
