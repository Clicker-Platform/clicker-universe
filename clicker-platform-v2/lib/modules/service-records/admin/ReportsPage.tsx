'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Printer, TrendingUp, Clock, CreditCard, Shield } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { downloadAsCSV } from '@/lib/utils/export';
import { Timestamp } from 'firebase/firestore';
import {
    getServiceRecordsByDateRange,
    computeReportSummary,
    formatCurrency,
    getDateRange,
    type ReportSummary,
} from '../api-reports';
import type { ServiceRecord, RecordStatus } from '../types';

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RecordStatus, { label: string; color: string; bg: string }> = {
    ACTIVE:    { label: 'Active',    color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-950/30' },
    COMPLETED: { label: 'Completed', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
    CANCELLED: { label: 'Cancelled', color: 'text-red-500 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30' },
};

const STATUS_ORDER: RecordStatus[] = ['COMPLETED', 'ACTIVE', 'CANCELLED'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    color = 'text-gray-900 dark:text-neutral-100',
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    color?: string;
}) {
    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-5 flex gap-4 items-start">
            <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800 shrink-0">
                <Icon className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-bold mt-0.5 truncate ${color}`}>{value}</p>
                {sub && <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-300">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function BarRow({ label, value, max, formatted }: { label: string; value: number; max: number; formatted?: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-neutral-400 w-36 shrink-0 truncate">{label}</span>
            <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                    className="h-2 rounded-full bg-gray-800 dark:bg-neutral-200 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 w-24 text-right shrink-0">
                {formatted ?? value}
            </span>
        </div>
    );
}

function Skeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                    <div key={i} className="h-28 rounded-lg bg-gray-100 dark:bg-neutral-800" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => (
                    <div key={i} className="h-56 rounded-lg bg-gray-100 dark:bg-neutral-800" />
                ))}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
    const { siteId } = useSite();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedWeekStart, setSelectedWeekStart] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');

    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rangeLabel, setRangeLabel] = useState('');

    // Init dates client-side to avoid hydration mismatch
    useEffect(() => {
        const now = new Date();
        setSelectedDate(now.toISOString().split('T')[0]);
        // Monday of current week
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        setSelectedWeekStart(monday.toISOString().split('T')[0]);
        setSelectedMonth(now.toISOString().slice(0, 7));
    }, []);

    const fetchReport = useCallback(async () => {
        if (!siteId || !selectedDate || !selectedMonth || !selectedWeekStart) return;
        setLoading(true);
        setError(null);
        try {
            const { start, end, label } = getDateRange(activeTab, selectedDate, selectedWeekStart, selectedMonth);
            setRangeLabel(label);
            const data = await getServiceRecordsByDateRange(siteId, start, end);
            setRecords(data);
            setSummary(computeReportSummary(data));
        } catch (err: unknown) {
            logger.error('service-records.reports.fetch.failed', { siteId, error: err });
            setError(err instanceof Error ? err.message : 'Failed to load report');
        } finally {
            setLoading(false);
        }
    }, [siteId, activeTab, selectedDate, selectedWeekStart, selectedMonth]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    // ── CSV Export ────────────────────────────────────────────────────────────
    function handleExport() {
        if (!records.length) return;
        const csvData = records.map(r => {
            const ts = r.createdAt instanceof Timestamp ? r.createdAt.toDate() : new Date();
            return {
                Date: ts.toLocaleString(),
                ID: r.id,
                Plate: r.vehiclePlate,
                Customer: r.memberName || '',
                ServiceType: r.serviceTypeName,
                Status: r.status,
                PaymentStatus: r.paymentStatus,
                PaymentMethod: r.paymentMethod || '',
                TotalAmount: r.totalAmount,
                AmountPaid: r.amountPaid,
                HasWarranty: r.hasWarranty ? 'Yes' : 'No',
                Notes: r.notes || '',
            };
        });
        const filename = `service-records-report-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
        downloadAsCSV(csvData, filename);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-6xl space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">
                        Service Records Reports
                    </h1>
                    {rangeLabel && (
                        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">{rangeLabel}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        disabled={loading || !records.length}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-700 dark:hover:bg-neutral-100"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                {/* Period tabs */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                    {(['daily', 'weekly', 'monthly'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100'
                                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Date picker */}
                <div>
                    {activeTab === 'daily' && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 px-3 py-2 text-sm focus:ring-0"
                        />
                    )}
                    {activeTab === 'weekly' && (
                        <input
                            type="date"
                            value={selectedWeekStart}
                            onChange={e => setSelectedWeekStart(e.target.value)}
                            className="rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 px-3 py-2 text-sm focus:ring-0"
                        />
                    )}
                    {activeTab === 'monthly' && (
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 px-3 py-2 text-sm focus:ring-0"
                        />
                    )}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* ── Content ── */}
            {loading ? (
                <Skeleton />
            ) : summary ? (
                <>
                    {/* ── 1. Revenue Summary Cards ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                        <StatCard
                            label="Total Revenue"
                            value={formatCurrency(summary.totalRevenue)}
                            sub={`${summary.completedCount} completed jobs`}
                            icon={TrendingUp}
                            color="text-green-600 dark:text-green-400"
                        />
                        <StatCard
                            label="Collected"
                            value={formatCurrency(summary.collectedRevenue)}
                            sub={summary.outstandingRevenue > 0 ? `${formatCurrency(summary.outstandingRevenue)} outstanding` : 'Fully collected'}
                            icon={CreditCard}
                        />
                        <StatCard
                            label="Avg Ticket"
                            value={formatCurrency(summary.avgTicket)}
                            sub="per completed job"
                            icon={BarChart3}
                        />
                        <StatCard
                            label="Total Records"
                            value={summary.totalRecords.toString()}
                            sub={summary.cancelledCount > 0 ? `${summary.cancellationRate.toFixed(1)}% cancellation` : 'No cancellations'}
                            icon={Clock}
                            color={summary.cancelledCount > 0 ? 'text-red-500 dark:text-red-400' : undefined}
                        />
                    </div>

                    {/* ── 2. Status Breakdown + Payment Status ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Status Breakdown */}
                        <SectionCard title="Pipeline Status">
                            <div className="space-y-4">
                                {STATUS_ORDER.map(status => {
                                    const count = summary.statusBreakdown[status] || 0;
                                    const cfg = STATUS_CONFIG[status];
                                    return (
                                        <div key={status} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-1 ml-4">
                                                <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-500 ${
                                                            status === 'COMPLETED' ? 'bg-green-500' :
                                                            status === 'ACTIVE' ? 'bg-blue-500' :
                                                            status === 'CANCELLED' ? 'bg-red-400' :
                                                            'bg-gray-300 dark:bg-neutral-600'
                                                        }`}
                                                        style={{ width: `${summary.totalRecords > 0 ? (count / summary.totalRecords) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-700 dark:text-neutral-300 w-8 text-right">{count}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {summary.totalRecords === 0 && (
                                    <p className="text-sm text-gray-400 dark:text-neutral-600 italic text-center py-4">No records in this period.</p>
                                )}
                            </div>
                        </SectionCard>

                        {/* Payment Analytics */}
                        <SectionCard title="Payment Analytics">
                            <div className="space-y-5">
                                {/* Payment Status */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase mb-3">Collection Status</p>
                                    <div className="space-y-2.5">
                                        {(['PAID', 'PARTIAL', 'UNPAID'] as const).map(s => {
                                            const count = summary.paymentStatusBreakdown[s] || 0;
                                            const total = (summary.totalRecords - summary.cancelledCount) || 1;
                                            return (
                                                <BarRow
                                                    key={s}
                                                    label={s.charAt(0) + s.slice(1).toLowerCase()}
                                                    value={count}
                                                    max={total}
                                                    formatted={`${count} records`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* Payment Method */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase mb-3">Payment Method</p>
                                    {Object.keys(summary.paymentMethodBreakdown).length > 0 ? (
                                        <div className="space-y-2.5">
                                            {Object.entries(summary.paymentMethodBreakdown)
                                                .sort(([,a],[,b]) => b - a)
                                                .map(([method, count]) => (
                                                    <BarRow
                                                        key={method}
                                                        label={method}
                                                        value={count}
                                                        max={Math.max(...Object.values(summary.paymentMethodBreakdown) as number[])}
                                                        formatted={`${count} records`}
                                                    />
                                                ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 dark:text-neutral-600 italic">No payment method data.</p>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* ── 3. Service Type Performance ── */}
                    <SectionCard title="Service Type Performance">
                        {summary.serviceTypeStats.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-neutral-800">
                                            <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-neutral-500 text-xs uppercase">Service Type</th>
                                            <th className="pb-3 px-4 font-medium text-gray-500 dark:text-neutral-500 text-xs uppercase text-right">Jobs</th>
                                            <th className="pb-3 px-4 font-medium text-gray-500 dark:text-neutral-500 text-xs uppercase text-right">Revenue</th>
                                            <th className="pb-3 pl-4 font-medium text-gray-500 dark:text-neutral-500 text-xs uppercase text-right">Avg Ticket</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.serviceTypeStats.map((st, idx) => (
                                            <tr key={st.serviceTypeId} className="border-b border-gray-50 dark:border-neutral-800/50 last:border-0">
                                                <td className="py-3 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-gray-300 dark:text-neutral-600 w-5">{idx + 1}</span>
                                                        <span className="font-medium text-gray-700 dark:text-neutral-300">{st.serviceTypeName}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono text-gray-600 dark:text-neutral-400">{st.recordCount}</td>
                                                <td className="py-3 px-4 text-right font-medium text-gray-800 dark:text-neutral-200">{formatCurrency(st.totalRevenue)}</td>
                                                <td className="py-3 pl-4 text-right text-gray-500 dark:text-neutral-500">{formatCurrency(st.avgTicket)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 dark:text-neutral-600 italic text-center py-6">No service data in this period.</p>
                        )}
                    </SectionCard>

                    {/* ── 4. Vehicle Insights + Member Split ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Vehicle Insights */}
                        <SectionCard title="Vehicle Insights">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{summary.uniqueVehicles}</p>
                                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">Unique Vehicles</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">
                                            {summary.topVehicles[0]?.visitCount ?? 0}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">Most Visits (top)</p>
                                    </div>
                                </div>
                                {summary.topVehicles.length > 0 && (
                                    <>
                                        <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase">Top Plates</p>
                                        <div className="space-y-2">
                                            {summary.topVehicles.map((v, i) => (
                                                <div key={v.vehiclePlate} className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-300 dark:text-neutral-600 font-mono w-4">{i + 1}</span>
                                                        <span className="font-mono font-medium text-gray-700 dark:text-neutral-300">{v.vehiclePlate}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-neutral-500">
                                                        <span>{v.visitCount} visit{v.visitCount !== 1 ? 's' : ''}</span>
                                                        {v.totalSpend > 0 && <span className="text-gray-700 dark:text-neutral-300 font-medium">{formatCurrency(v.totalSpend)}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {summary.topVehicles.length === 0 && (
                                    <p className="text-sm text-gray-400 dark:text-neutral-600 italic text-center py-4">No vehicle data.</p>
                                )}
                            </div>
                        </SectionCard>

                        {/* Member vs Walk-in + Warranty */}
                        <div className="space-y-4">
                            {/* Member split */}
                            <SectionCard title="Customer Type">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.memberRecords}</p>
                                            <p className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">Members</p>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 text-center">
                                            <p className="text-2xl font-bold text-gray-700 dark:text-neutral-300">{summary.walkInRecords}</p>
                                            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">Walk-ins</p>
                                        </div>
                                    </div>
                                    {(summary.memberRecords + summary.walkInRecords) > 0 && (
                                        <div className="flex rounded-full h-2.5 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                                            <div
                                                className="bg-blue-500 transition-all duration-500"
                                                style={{ width: `${(summary.memberRecords / (summary.memberRecords + summary.walkInRecords)) * 100}%` }}
                                            />
                                            <div className="bg-gray-300 dark:bg-neutral-600 flex-1" />
                                        </div>
                                    )}
                                </div>
                            </SectionCard>

                            {/* Warranty */}
                            <SectionCard title="Warranty Cards">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                                        <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-gray-900 dark:text-neutral-100">{summary.warrantyIssuedCount}</p>
                                        <p className="text-sm text-gray-500 dark:text-neutral-500">warranty cards issued this period</p>
                                    </div>
                                </div>
                                {summary.completedCount > 0 && (
                                    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-3">
                                        {((summary.warrantyIssuedCount / summary.completedCount) * 100).toFixed(0)}% of completed jobs issued a warranty
                                    </p>
                                )}
                            </SectionCard>
                        </div>
                    </div>
                </>
            ) : (
                !loading && !error && (
                    <div className="text-center py-16 text-gray-400 dark:text-neutral-600 text-sm">
                        Select a period to load the report.
                    </div>
                )
            )}

            {/* ── PRINT ONLY ───────────────────────────────────────────── */}
            {summary && (
                <div className="hidden print:block text-black bg-white">
                    <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-tight">Service Records Report</h1>
                            <p className="text-sm mt-0.5">{rangeLabel}</p>
                        </div>
                        <p className="text-xs">Generated: {new Date().toLocaleString()}</p>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-0 border border-black mb-6">
                        {[
                            { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue) },
                            { label: 'Completed Jobs', value: summary.completedCount.toString() },
                            { label: 'Avg Ticket', value: formatCurrency(summary.avgTicket) },
                            { label: 'Total Records', value: summary.totalRecords.toString() },
                        ].map((item, i) => (
                            <div key={i} className={`p-3 ${i < 3 ? 'border-r border-black' : ''}`}>
                                <p className="text-xs uppercase text-gray-500 font-bold">{item.label}</p>
                                <p className="text-xl font-bold">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Status */}
                    <div className="mb-6">
                        <h2 className="text-xs font-bold uppercase border-b border-black mb-2 pb-1">Pipeline Status</h2>
                        <div className="flex gap-6">
                            {STATUS_ORDER.map(s => (
                                <div key={s}>
                                    <p className="text-xs text-gray-500">{STATUS_CONFIG[s].label}</p>
                                    <p className="text-lg font-bold">{summary.statusBreakdown[s] || 0}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Service Types */}
                    {summary.serviceTypeStats.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-xs font-bold uppercase border-b border-black mb-2 pb-1">Service Type Performance</h2>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-gray-400">
                                        <th className="py-1 text-left">Service Type</th>
                                        <th className="py-1 text-right">Jobs</th>
                                        <th className="py-1 text-right">Revenue</th>
                                        <th className="py-1 text-right">Avg Ticket</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.serviceTypeStats.map(st => (
                                        <tr key={st.serviceTypeId} className="border-b border-gray-200">
                                            <td className="py-1">{st.serviceTypeName}</td>
                                            <td className="py-1 text-right">{st.recordCount}</td>
                                            <td className="py-1 text-right">{formatCurrency(st.totalRevenue)}</td>
                                            <td className="py-1 text-right">{formatCurrency(st.avgTicket)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Payment + Vehicles row */}
                    <div className="flex gap-8">
                        <div className="flex-1">
                            <h2 className="text-xs font-bold uppercase border-b border-black mb-2 pb-1">Payment</h2>
                            <div className="flex gap-6 mb-2">
                                {(['PAID','PARTIAL','UNPAID'] as const).map(s => (
                                    <div key={s}>
                                        <p className="text-xs text-gray-500">{s}</p>
                                        <p className="text-lg font-bold">{summary.paymentStatusBreakdown[s]}</p>
                                    </div>
                                ))}
                            </div>
                            {Object.entries(summary.paymentMethodBreakdown).map(([m, c]) => (
                                <p key={m} className="text-xs">{m}: {c}</p>
                            ))}
                        </div>
                        {summary.topVehicles.length > 0 && (
                            <div className="flex-1">
                                <h2 className="text-xs font-bold uppercase border-b border-black mb-2 pb-1">Top Vehicles</h2>
                                {summary.topVehicles.slice(0, 5).map(v => (
                                    <p key={v.vehiclePlate} className="text-xs">{v.vehiclePlate} — {v.visitCount} visits</p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
