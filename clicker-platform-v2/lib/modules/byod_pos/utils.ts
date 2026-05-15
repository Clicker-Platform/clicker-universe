
import { POSOrder, TaxBreakdown } from './types';
import { Timestamp } from 'firebase/firestore';

/**
 * Calculates the aggregated totals for a group of orders (Bill).
 * Sums all items, then applies the tax rates found in the most recent order.
 */
export function calculateBillTotals(orders: POSOrder[]): TaxBreakdown {
    if (!orders || orders.length === 0) {
        return {
            subtotal: 0,
            serviceCharge: 0,
            restaurantTax: 0,
            total: 0,
            serviceChargeRate: 0,
            restaurantTaxRate: 0
        };
    }

    // 1. Aggregate Subtotal from ALL items in ALL orders
    let aggregatedSubtotal = 0;
    orders.forEach(order => {
        // Use the snapshot subtotal if available, or recalculate from items
        // Recalculating from items is safer for "Bill Aggregation" to ensure
        // we are summing raw values before tax.
        // However, order.taxBreakdown.subtotal might already be the raw sum.
        // safest is item sum.
        const orderSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        aggregatedSubtotal += orderSubtotal;
    });

    // 2. Determine Tax Rates
    // We use the rates from the most recent order (or the first one found with rates)
    // assuming settings are consistent for the bill.
    const referenceOrder = orders.find(o => o.taxBreakdown?.serviceChargeRate !== undefined) || orders[0];
    const serviceRate = referenceOrder.taxBreakdown?.serviceChargeRate || 0;
    const taxRate = referenceOrder.taxBreakdown?.restaurantTaxRate || 0;

    // 3. Calculate Service Charge
    // Service Charge = Subtotal * Rate / 100
    // Rounding: Standard accounting usually rounds per line or per total. 
    // We round at the total level here as requested.
    const serviceCharge = Math.round(aggregatedSubtotal * (serviceRate / 100));

    // 4. Calculate Restaurant Tax (PB1)
    // PB1 = (Subtotal + Service Charge) * Rate / 100
    const taxableBase = aggregatedSubtotal + serviceCharge;
    const restaurantTax = Math.round(taxableBase * (taxRate / 100));

    // 5. Total
    const total = aggregatedSubtotal + serviceCharge + restaurantTax;

    return {
        subtotal: aggregatedSubtotal,
        serviceCharge,
        restaurantTax,
        total,
        serviceChargeRate: serviceRate,
        restaurantTaxRate: taxRate
    };
}

export function createAggregatedOrder(orders: POSOrder[]): POSOrder {
    if (orders.length === 1) return orders[0];

    const totals = calculateBillTotals(orders);
    const referenceOrder = orders[0];
    const allItems = orders.flatMap(o => o.items);

    return {
        ...referenceOrder,
        id: `BILL-${orders.length}-${Date.now().toString().slice(-4)}`,
        items: allItems,
        total: totals.total,
        taxBreakdown: totals,
        createdAt: Timestamp.now(),
        status: 'completed' as POSOrder['status'],
        paymentStatus: 'paid'
    };
}
