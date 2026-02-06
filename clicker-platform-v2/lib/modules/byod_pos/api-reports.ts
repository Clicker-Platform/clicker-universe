
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    limit,
    startAfter,
    QueryConstraint,
    QueryDocumentSnapshot,
    getCountFromServer,
    getAggregateFromServer,
    sum,
    count
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { POSOrder } from './types';
import { getPOSSettings } from './api';
import { ORDERS_COLLECTION } from './constants';
import { getBusinessDayStart, RESTAURANT_TIMEZONE } from '@/lib/utils/date-timezone';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Generic fetch with pagination support
 */
async function fetchOrders(
    siteId: string,
    start: Date,
    end: Date,
    limitCount?: number,
    lastDoc?: QueryDocumentSnapshot
): Promise<{ orders: POSOrder[], lastVisible: QueryDocumentSnapshot | null }> {
    if (!siteId) return { orders: [], lastVisible: null };

    const constraints: QueryConstraint[] = [
        where('createdAt', '>=', Timestamp.fromDate((start && !isNaN(start.getTime())) ? start : new Date())),
        where('createdAt', '<', Timestamp.fromDate((end && !isNaN(end.getTime())) ? end : new Date())),
        // STRICT: Only 'completed' (settled) orders as requested for Reports
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc')
    ];

    if (limitCount) {
        constraints.push(limit(limitCount));
    }

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'sites', siteId, ORDERS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as POSOrder));

    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { orders, lastVisible };
}

/**
 * Helper to get the business day start and end timestamps for a given date.
 */
async function getBusinessDayRange(siteId: string, date: Date): Promise<{ start: Date; end: Date }> {
    const settings = await getPOSSettings(siteId);
    const startHour = settings.businessDayStartHour || 4;

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const startString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(startHour).padStart(2, '0')}:00:00`;
    const start = fromZonedTime(startString, RESTAURANT_TIMEZONE);

    const end = new Date(start);
    end.setHours(end.getHours() + 24);

    return { start, end };
}

/**
 * Fetch orders for a specific business day.
 */
export async function getDailyReport(
    siteId: string,
    date: Date,
    limitCount?: number,
    lastDoc?: QueryDocumentSnapshot
) {
    const { start, end } = await getBusinessDayRange(siteId, date);
    return fetchOrders(siteId, start, end, limitCount, lastDoc);
}

/**
 * Fetch orders for a week range.
 */
export async function getWeeklyReport(
    siteId: string,
    startDate: Date,
    limitCount?: number,
    lastDoc?: QueryDocumentSnapshot
) {
    const settings = await getPOSSettings(siteId);
    const startHour = settings.businessDayStartHour || 4;

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const day = startDate.getDate();

    const startString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(startHour).padStart(2, '0')}:00:00`;
    const start = fromZonedTime(startString, RESTAURANT_TIMEZONE);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return fetchOrders(siteId, start, end, limitCount, lastDoc);
}

/**
 * Fetch orders for a specific month.
 */
export async function getMonthlyReport(
    siteId: string,
    year: number,
    month: number,
    limitCount?: number,
    lastDoc?: QueryDocumentSnapshot
) {
    const settings = await getPOSSettings(siteId);
    const startHour = settings.businessDayStartHour || 4;

    const m = month + 1;

    const startString = `${year}-${String(m).padStart(2, '0')}-01 ${String(startHour).padStart(2, '0')}:00:00`;
    const start = fromZonedTime(startString, RESTAURANT_TIMEZONE);

    let endYear = year;
    let endMonth = m + 1;
    if (endMonth > 12) {
        endMonth = 1;
        endYear++;
    }

    const endString = `${endYear}-${String(endMonth).padStart(2, '0')}-01 ${String(startHour).padStart(2, '0')}:00:00`;
    const end = fromZonedTime(endString, RESTAURANT_TIMEZONE);

    return fetchOrders(siteId, start, end, limitCount, lastDoc);
}

// Local logic moved to calculator.ts
import { calculateReportSummary, ReportSummary } from '../pos-reporting/calculator';
export type { ReportSummary }; // Re-export for consumers if needed, or just let them import from calculator.
// Actually, page.tsx imports it from here currently. So re-exporting is good for backward compat.

export { calculateReportSummary };

/**
 * Legacy Client-Side Aggregation (Kept for fallback or detailed breakdown if needed)
 */
export function generateReportSummary(orders: POSOrder[]): ReportSummary {
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
 * Server-side calculation of report stats using Firestore Aggregations.
 */
export async function getReportStats(siteId: string, start: Date, end: Date): Promise<ReportSummary> {
    if (!siteId) throw new Error("siteId is required for report stats");
    const coll = collection(db, 'sites', siteId, ORDERS_COLLECTION);

    // 1. Total Sales & Count (completed/ready/served)
    const validQuery = query(
        coll,
        where('createdAt', '>=', Timestamp.fromDate((start && !isNaN(start.getTime())) ? start : new Date())),
        where('createdAt', '<', Timestamp.fromDate((end && !isNaN(end.getTime())) ? end : new Date())),
        where('status', '==', 'completed')
    );

    const validSnapshot = await getAggregateFromServer(validQuery, {
        totalSales: sum('total'),
        count: count()
    });

    const totalSales = validSnapshot.data().totalSales || 0;
    const totalOrders = validSnapshot.data().count || 0;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // 2. Cancelled Stats
    const cancelledQuery = query(
        coll,
        where('createdAt', '>=', Timestamp.fromDate((start && !isNaN(start.getTime())) ? start : new Date())),
        where('createdAt', '<', Timestamp.fromDate((end && !isNaN(end.getTime())) ? end : new Date())),
        where('status', '==', 'cancelled')
    );

    const cancelledSnapshot = await getAggregateFromServer(cancelledQuery, {
        value: sum('total'),
        count: count()
    });

    // 3. Payment Breakdown (Efficient Parallel Aggregation)
    // Since we know the valid payment methods, we can aggregate them individually.
    // This is 4 reads vs N reads (downloading all docs).
    const paymentMethods = ['cash', 'card', 'qris', 'other'];
    const paymentBreakdown: Record<string, number> = {};

    await Promise.all(paymentMethods.map(async (method) => {
        const pQuery = query(
            coll,
            where('createdAt', '>=', Timestamp.fromDate((start && !isNaN(start.getTime())) ? start : new Date())),
            where('createdAt', '<', Timestamp.fromDate((end && !isNaN(end.getTime())) ? end : new Date())),
            where('status', '==', 'completed'),
            where('paymentMethod', '==', method)
        );
        const pSnap = await getAggregateFromServer(pQuery, {
            total: sum('total')
        });
        const val = pSnap.data().total;
        if (val > 0) paymentBreakdown[method] = val;
    }));

    return {
        totalSales,
        totalOrders,
        averageOrderValue,
        paymentBreakdown,
        cancelledOrders: cancelledSnapshot.data().count || 0,
        cancelledValue: cancelledSnapshot.data().value || 0
    };
}


// Phase 4: Items Sales Report (Client-Side Aggregation Fetcher)
// Fetches ALL completed orders for the period to allow item-level calculation
export async function getItemsSales(siteId: string, start: Date, end: Date): Promise<POSOrder[]> {
    if (!siteId) return [];
    const q = query(
        collection(db, 'sites', siteId, ORDERS_COLLECTION),
        where('createdAt', '>=', Timestamp.fromDate((start && !isNaN(start.getTime())) ? start : new Date())),
        where('createdAt', '<', Timestamp.fromDate((end && !isNaN(end.getTime())) ? end : new Date())),
        // STRICT: Only 'completed' (Paid) orders as requested
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as POSOrder[];
}
