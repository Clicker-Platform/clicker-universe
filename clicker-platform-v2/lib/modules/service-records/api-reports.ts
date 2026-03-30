import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SR_RECORDS, OUTLET_ID_V1 } from './constants';
import type { ServiceRecord, RecordStatus, PaymentMethod } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceTypeStats {
    serviceTypeId: string;
    serviceTypeName: string;
    recordCount: number;
    totalRevenue: number;
    avgTicket: number;
}

export interface VehicleStats {
    vehiclePlate: string;
    visitCount: number;
    totalSpend: number;
}

export interface ReportSummary {
    // Revenue
    totalRevenue: number;          // sum of totalAmount for COMPLETED
    collectedRevenue: number;      // sum of amountPaid for all non-CANCELLED
    outstandingRevenue: number;    // totalRevenue - collectedRevenue
    avgTicket: number;             // totalRevenue / completedCount || 0

    // Volume
    totalRecords: number;
    completedCount: number;
    cancelledCount: number;
    cancellationRate: number;      // cancelledCount / totalRecords * 100

    // Status breakdown
    statusBreakdown: Record<RecordStatus, number>;

    // Service type performance (sorted by revenue desc)
    serviceTypeStats: ServiceTypeStats[];

    // Payment status breakdown
    paymentStatusBreakdown: {
        PAID: number;
        PARTIAL: number;
        UNPAID: number;
    };

    // Payment method breakdown (completed records only)
    paymentMethodBreakdown: Partial<Record<PaymentMethod, number>>;

    // Vehicle insights
    uniqueVehicles: number;
    topVehicles: VehicleStats[];   // top 10 by visitCount

    // Member vs walk-in
    memberRecords: number;
    walkInRecords: number;

    // Warranty
    warrantyIssuedCount: number;   // COMPLETED records with hasWarranty=true
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Fetch all service records within a date range (by createdAt).
 * Returns records of any status so the report can show the full pipeline.
 */
export async function getServiceRecordsByDateRange(
    siteId: string,
    start: Date,
    end: Date
): Promise<ServiceRecord[]> {
    const outletId = OUTLET_ID_V1(siteId);
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const q = query(
        collection(db, 'sites', siteId, SR_RECORDS),
        where('outletId', '==', outletId),
        where('createdAt', '>=', startTs),
        where('createdAt', '<', endTs),
        orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRecord));
}

// ─── Aggregation (pure — no Firestore calls) ──────────────────────────────────

export function computeReportSummary(records: ServiceRecord[]): ReportSummary {
    const statusBreakdown: Record<RecordStatus, number> = {
        DRAFT: 0,
        IN_PROGRESS: 0,
        PENDING_APPROVAL: 0,
        COMPLETED: 0,
        CANCELLED: 0,
    };

    const paymentStatusBreakdown = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
    const paymentMethodBreakdown: Partial<Record<PaymentMethod, number>> = {};
    const serviceTypeMap: Map<string, ServiceTypeStats> = new Map();
    const vehicleMap: Map<string, VehicleStats> = new Map();

    let totalRevenue = 0;
    let collectedRevenue = 0;
    let memberRecords = 0;
    let walkInRecords = 0;
    let warrantyIssuedCount = 0;

    for (const r of records) {
        // Status
        statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;

        // Skip CANCELLED for financial metrics
        if (r.status === 'CANCELLED') continue;

        // Revenue (only count COMPLETED as confirmed revenue)
        if (r.status === 'COMPLETED') {
            totalRevenue += r.totalAmount || 0;
            if (r.hasWarranty) warrantyIssuedCount++;
        }

        // Collected (amountPaid regardless of status, except cancelled)
        collectedRevenue += r.amountPaid || 0;

        // Payment status
        paymentStatusBreakdown[r.paymentStatus] = (paymentStatusBreakdown[r.paymentStatus] || 0) + 1;

        // Payment method (non-null)
        if (r.paymentMethod) {
            paymentMethodBreakdown[r.paymentMethod] = (paymentMethodBreakdown[r.paymentMethod] || 0) + 1;
        }

        // Service type performance
        const existing = serviceTypeMap.get(r.serviceTypeId);
        const amount = r.status === 'COMPLETED' ? (r.totalAmount || 0) : 0;
        if (existing) {
            existing.recordCount++;
            existing.totalRevenue += amount;
        } else {
            serviceTypeMap.set(r.serviceTypeId, {
                serviceTypeId: r.serviceTypeId,
                serviceTypeName: r.serviceTypeName,
                recordCount: 1,
                totalRevenue: amount,
                avgTicket: 0,
            });
        }

        // Vehicle
        const plate = r.vehiclePlate;
        const vExisting = vehicleMap.get(plate);
        const spend = r.status === 'COMPLETED' ? (r.totalAmount || 0) : 0;
        if (vExisting) {
            vExisting.visitCount++;
            vExisting.totalSpend += spend;
        } else {
            vehicleMap.set(plate, { vehiclePlate: plate, visitCount: 1, totalSpend: spend });
        }

        // Member vs walk-in
        if (r.memberId) {
            memberRecords++;
        } else {
            walkInRecords++;
        }
    }

    const completedCount = statusBreakdown['COMPLETED'];
    const cancelledCount = statusBreakdown['CANCELLED'];
    const totalRecords = records.length;

    // Avg ticket for completed records only
    const avgTicket = completedCount > 0 ? totalRevenue / completedCount : 0;

    // Compute avgTicket per service type
    const serviceTypeStats: ServiceTypeStats[] = Array.from(serviceTypeMap.values())
        .map(s => ({
            ...s,
            avgTicket: s.recordCount > 0 ? s.totalRevenue / s.recordCount : 0,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Top 10 vehicles
    const topVehicles = Array.from(vehicleMap.values())
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 10);

    return {
        totalRevenue,
        collectedRevenue,
        outstandingRevenue: Math.max(0, totalRevenue - collectedRevenue),
        avgTicket,
        totalRecords,
        completedCount,
        cancelledCount,
        cancellationRate: totalRecords > 0 ? (cancelledCount / totalRecords) * 100 : 0,
        statusBreakdown,
        serviceTypeStats,
        paymentStatusBreakdown,
        paymentMethodBreakdown,
        uniqueVehicles: vehicleMap.size,
        topVehicles,
        memberRecords,
        walkInRecords,
        warrantyIssuedCount,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function getDateRange(
    mode: 'daily' | 'weekly' | 'monthly',
    selectedDate: string,
    selectedWeekStart: string,
    selectedMonth: string
): { start: Date; end: Date; label: string } {
    if (mode === 'daily') {
        const d = new Date(selectedDate);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        return {
            start, end,
            label: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        };
    }
    if (mode === 'weekly') {
        const d = new Date(selectedWeekStart);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 0, 0, 0);
        const endLabel = new Date(end.getTime() - 1);
        return {
            start, end,
            label: `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endLabel.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        };
    }
    // monthly
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0);
    return {
        start, end,
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
}
