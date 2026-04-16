'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Calendar, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    getDailyReport,
    getWeeklyReport,
    getMonthlyReport,
    getReportStats,
    getItemsSales,
    ReportSummary
} from '@/lib/modules/byod_pos/api-reports';
import { formatCurrency, calculateItemsSales, ItemSalesSummary } from '@/lib/modules/byod_pos/reporting-utils';
import { POSOrder, POSSettings } from '@/lib/modules/byod_pos/types';
import { downloadAsCSV } from '@/lib/utils/export';
import { getPOSSettings } from '@/lib/modules/byod_pos/api';
import { Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { useSite } from '@/lib/site-context';

export default function POSReportsPage() {
    const { siteId } = useSite();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    // Initialize with empty strings to prevent hydration mismatch (server time vs client time)
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    useEffect(() => {
        // Set initial dates on client side only
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setSelectedWeekStart(getStartOfWeek(new Date()).toISOString().split('T')[0]);
        setSelectedMonth(new Date().toISOString().slice(0, 7));
    }, []);

    const [orders, setOrders] = useState<POSOrder[]>([]);
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<POSSettings | null>(null);

    // Items Sales Report State
    const [itemsSummary, setItemsSummary] = useState<ItemSalesSummary[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Server-Side Pagination State
    const ITEMS_PER_PAGE = 20;
    const [currentPage, setCurrentPage] = useState(1);
    // Map of Page Number -> StartAfter Cursor (Page 1 has no cursor/undefined)
    const [cursors, setCursors] = useState<Record<number, QueryDocumentSnapshot | undefined>>({});

    // Total count from stats for calculating total pages
    const [totalOrdersCount, setTotalOrdersCount] = useState(0);

    useEffect(() => {
        if (siteId) {
            getPOSSettings(siteId).then(setSettings);
        }
    }, [siteId]);

    // Reset pagination when filter changes
    useEffect(() => {
        if (!siteId || !selectedDate) return;
        setCurrentPage(1);
        setCursors({});
        setTotalOrdersCount(0);
        fetchReport(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedDate, selectedWeekStart, selectedMonth, siteId]);

    useEffect(() => {
        if (!siteId) return;
        // When page changes, fetch that page
        fetchReport(currentPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, siteId]);

    async function fetchReport(page: number) {
        if (!siteId) return;
        setLoading(true);
        try {
            // If page 1, fetch Stats concurrently
            if (page === 1) {
                const { start: rStart, end: rEnd } = getReportRange();

                // Parallel Fetch: Stats + Items Sales
                Promise.all([
                    getReportStats(siteId, rStart, rEnd),
                    fetchItemsSales(rStart, rEnd)
                ]).then(([stats, _]) => {
                    setSummary(stats);
                    setTotalOrdersCount(stats.totalOrders);
                });
            }

            const cursor = cursors[page];

            let result;
            if (activeTab === 'daily') {
                result = await getDailyReport(siteId, new Date(selectedDate), ITEMS_PER_PAGE, cursor);
            } else if (activeTab === 'weekly') {
                result = await getWeeklyReport(siteId, new Date(selectedWeekStart), ITEMS_PER_PAGE, cursor);
            } else if (activeTab === 'monthly') {
                const [year, month] = selectedMonth.split('-').map(Number);
                result = await getMonthlyReport(siteId, year, month - 1, ITEMS_PER_PAGE, cursor);
            }

            if (result) {
                setOrders(result.orders);
                // Set cursor for NEXT page (page + 1)
                if (result.lastVisible) {
                    setCursors(prev => ({
                        ...prev,
                        [page + 1]: result.lastVisible!
                    }));
                }
            }

        } catch (error) {
            console.error("Failed to fetch report", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchItemsSales(start: Date, end: Date) {
        if (!siteId) return;
        setLoadingItems(true);
        try {
            const completedOrders = await getItemsSales(siteId, start, end);
            const itemsStats = calculateItemsSales(completedOrders);
            setItemsSummary(itemsStats);
        } catch (error) {
            console.error("Failed to fetch items sales", error);
        } finally {
            setLoadingItems(false);
        }
    }

    // Helper to match API logic (approximate) just for stats range
    function getReportRange() {
        const startHour = settings?.businessDayStartHour || 4;

        let start = new Date();
        let end = new Date();

        if (activeTab === 'daily') {
            // For daily stats, we want strict alignment. 
            // Ideally we import getBusinessDayRange but it's internal.
            // Let's just use 4AM to 4AM logic locally for the STATS
            const d = new Date(selectedDate);
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, 0, 0);
            end = new Date(start);
            end.setDate(end.getDate() + 1);
        } else if (activeTab === 'weekly') {
            const d = new Date(selectedWeekStart);
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, 0, 0);
            end = new Date(start);
            end.setDate(end.getDate() + 7);
        } else if (activeTab === 'monthly') {
            const [y, m] = selectedMonth.split('-').map(Number);
            start = new Date(y, m - 1, 1, startHour, 0, 0);
            end = new Date(y, m, 1, startHour, 0, 0);
        }
        return { start, end };
    }

    async function handleExport() {
        if (!siteId) return;
        // Fetch ALL records for export (no pagination args)
        let allOrders: POSOrder[] = [];

        try {
            let result;
            if (activeTab === 'daily') {
                result = await getDailyReport(siteId, new Date(selectedDate));
            } else if (activeTab === 'weekly') {
                result = await getWeeklyReport(siteId, new Date(selectedWeekStart));
            } else if (activeTab === 'monthly') {
                const [year, month] = selectedMonth.split('-').map(Number);
                result = await getMonthlyReport(siteId, year, month - 1);
            }
            if (result) allOrders = result.orders;
        } catch (e) {
            console.error("Export fetch failed", e);
            return;
        }

        if (!allOrders.length) return;

        // Flatten data for CSV
        const csvData = allOrders.map(o => {
            const date = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
            return {
                OrderID: o.id,
                Date: date.toLocaleString(),
                Total: o.total,
                Status: o.status,
                PaymentStatus: o.paymentStatus || 'unknown',
                PaymentMethod: o.paymentMethod || 'unknown',
                Items: o.items.map(i => `${i.quantity}x ${i.name}`).join('; '),
                Table: o.tableNumber || '',
                Customer: o.customerName || '',
                ServerMember: o.memberName || ''
            };
        });

        const filename = `pos-report-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
        downloadAsCSV(csvData, filename);
    }

    function handlePrint() {
        window.print();
    }

    // Pagination Controls
    const totalPages = Math.ceil(totalOrdersCount / ITEMS_PER_PAGE) || 1;

    function handleNextPage() {
        if (currentPage < totalPages) setCurrentPage(p => p + 1);
    }

    function handlePrevPage() {
        if (currentPage > 1) setCurrentPage(p => p - 1);
    }

    return (
        <div>
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-1">POS reports</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium text-sm md:text-base">View your sales performance and analytics</p>
                </div>
            </div>

            {/* SCREEN ONLY VIEW */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col min-h-[600px] h-full print:hidden">
                {/* Header / Toolbar (Controls) */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                    {/* Left Side: Tabs & Date */}
                    <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                        {/* Reporting Period Tabs */}
                        <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-1 w-full md:w-auto overflow-x-auto">
                            {['daily', 'weekly', 'monthly'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex-1 md:flex-none text-center whitespace-nowrap ${activeTab === tab
                                        ? 'bg-black dark:bg-white text-white dark:text-black'
                                        : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs */}
                        <div className="w-full md:w-auto">
                            {activeTab === 'daily' && (
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 text-sm rounded-lg block w-full p-2.5 h-10 md:w-40"
                                />
                            )}
                            {activeTab === 'weekly' && (
                                <input
                                    type="date"
                                    value={selectedWeekStart}
                                    onChange={(e) => setSelectedWeekStart(e.target.value)}
                                    className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 text-sm rounded-lg block w-full p-2.5 h-10 md:w-40"
                                />
                            )}
                            {activeTab === 'monthly' && (
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 text-sm rounded-lg block w-full p-2.5 h-10 md:w-40"
                                />
                            )}
                        </div>
                    </div>

                    {/* Right Side: Actions */}
                    <div className="grid grid-cols-2 md:flex gap-3 w-full xl:w-auto shrink-0">
                        <button
                            onClick={handleExport}
                            disabled={loading || totalOrdersCount === 0}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span className="md:hidden lg:inline">Export CSV</span>
                            <span className="hidden md:inline lg:hidden">Export</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-neutral-100"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50/30 dark:bg-neutral-950">
                    {/* Summary Cards */}
                    {summary ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
                            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-lg md:rounded-lg border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:print:border-gray-300">
                                <p className="text-[10px] md:text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase">Total Sales</p>
                                <p className="text-xl md:text-2xl font-bold mt-1 dark:text-neutral-100">
                                    {formatCurrency(summary.totalSales)}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-lg md:rounded-lg border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:print:border-gray-300">
                                <p className="text-[10px] md:text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase">Total Orders</p>
                                <p className="text-xl md:text-2xl font-bold mt-1 dark:text-neutral-100">{summary.totalOrders}</p>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-lg md:rounded-lg border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:print:border-gray-300">
                                <p className="text-[10px] md:text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase">Avg. Ticket</p>
                                <p className="text-xl md:text-2xl font-bold mt-1 dark:text-neutral-100">
                                    {formatCurrency(summary.averageOrderValue)}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-lg md:rounded-lg border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:print:border-gray-300">
                                <p className="text-[10px] md:text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase">Cancelled</p>
                                <p className="text-xl md:text-2xl font-bold mt-1 text-red-500 dark:text-red-400">
                                    {summary.cancelledOrders} <span className="text-xs md:text-sm font-normal text-gray-400 dark:text-neutral-600">({formatCurrency(summary.cancelledValue)})</span>
                                </p>
                            </div>

                            {/* Payment Breakdown Card */}
                            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-lg md:rounded-lg border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:print:border-gray-300 col-span-2 md:col-span-4 lg:col-span-4">
                                <p className="text-[10px] md:text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase mb-2 md:mb-3">Payment Breakdown</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                                    {(Object.entries(summary.paymentBreakdown || {})).length > 0 ? (
                                        Object.entries(summary.paymentBreakdown).map(([method, amount]) => (
                                            <div key={method} className="flex flex-col">
                                                <span className="text-[10px] md:text-xs capitalize text-gray-400 dark:text-neutral-500">{method.replace('_', ' ')}</span>
                                                <span className="font-bold text-base md:text-lg dark:text-neutral-200">{formatCurrency(amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-400 dark:text-neutral-600 italic col-span-4">No payment data available.</p>
                                    )}
                                </div>
                            </div>

                            {/* ITEM SALES / PRODUCT PERFORMANCE CARD */}
                            <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 rounded-lg md:rounded-lg border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:print:border-gray-300 col-span-2 md:col-span-4 lg:col-span-4">
                                <div className="flex justify-between items-center mb-2 md:mb-3">
                                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase">Product Performance</p>
                                    <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-mono">Top Selling (Completed)</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs md:text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 font-medium border-b border-gray-100 dark:border-neutral-700">
                                            <tr>
                                                <th className="py-2 px-2 md:px-3 w-8 md:w-12">#</th>
                                                <th className="py-2 px-2 md:px-3">Product Name</th>
                                                <th className="py-2 px-2 md:px-3 text-right">Qty</th>
                                                <th className="py-2 px-2 md:px-3 text-right">Rev</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingItems ? (
                                                <tr><td colSpan={4} className="p-8 text-center text-gray-400 dark:text-neutral-600 text-xs">Loading product data...</td></tr>
                                            ) : itemsSummary.length > 0 ? (
                                                itemsSummary.slice(0, 10).map((item, index) => (
                                                    <tr key={item.id} className="border-b border-gray-50 dark:border-neutral-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-neutral-800/50">
                                                        <td className="py-2 px-2 md:px-3 font-mono text-gray-400 dark:text-neutral-600 text-xs">{index + 1}</td>
                                                        <td className="py-2 px-2 md:px-3 font-medium text-gray-700 dark:text-neutral-300">{item.name}</td>
                                                        <td className="py-2 px-2 md:px-3 text-right font-mono text-gray-600 dark:text-neutral-400">{item.quantity}</td>
                                                        <td className="py-2 px-2 md:px-3 text-right font-medium text-gray-800 dark:text-neutral-200">{formatCurrency(item.revenue)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="p-8 text-center text-gray-400 dark:text-neutral-600 text-xs italic">No items sold in this period.</td></tr>
                                            )}
                                            {!loadingItems && itemsSummary.length > 10 && (
                                                <tr>
                                                    <td colSpan={4} className="py-2 text-center text-xs text-brand-orange font-medium cursor-pointer hover:underline" onClick={() => {
                                                        const win = window.open('', '_blank');
                                                        if (win) {
                                                            win.document.write('<pre>' + JSON.stringify(itemsSummary, null, 2) + '</pre>');
                                                        } else {
                                                            alert('Full list: \n' + itemsSummary.map(i => `${i.name}: ${i.quantity}`).join('\n'));
                                                        }
                                                    }}>
                                                        View all {itemsSummary.length} products
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Skeleton / Loading State for Summary
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-gray-100 dark:border-neutral-800 h-24 animate-pulse bg-gray-50 dark:bg-neutral-800" />
                            ))}
                        </div>
                    )}

                    {/* Order List Table */}
                    <div className="mt-8 break-before-page">
                        <div className="flex justify-between items-end mb-3">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-neutral-300">Detailed Orders</h3>
                            <span className="text-xs text-gray-400 dark:text-neutral-500">
                                Showing {orders.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE + 1) : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, totalOrdersCount)} of {totalOrdersCount}
                            </span>
                        </div>

                        <div className="bg-transparent md:bg-white dark:md:bg-neutral-900 rounded-none md:rounded-lg border-none md:border md:border-gray-100 dark:md:border-neutral-800 shadow-none md:overflow-hidden print:border-gray-300 flex flex-col min-h-[400px]">
                             <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-sm min-w-full">
                                    <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                        <tr>
                                            <th className="px-2 md:px-4 py-2 md:py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs md:text-sm whitespace-nowrap w-[80px] md:w-auto">Time</th>
                                            <th className="px-2 md:px-4 py-2 md:py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs md:text-sm w-full min-w-[140px]">Order</th>
                                            <th className="px-2 md:px-4 py-2 md:py-3 font-medium text-gray-600 dark:text-neutral-400 text-xs md:text-sm text-right whitespace-nowrap">Total</th>
                                        </tr>
                                    </thead>
                                        <tbody>
                                        {loading ? (
                                            <tr><td colSpan={4} className="p-12 text-center text-gray-400 dark:text-neutral-600">Loading orders...</td></tr>
                                        ) : orders.map(order => {
                                            const date = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt);
                                            const isCancelled = order.status === 'cancelled';
                                            const itemsSummary = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');

                                            return (
                                                <tr key={order.id} className={`border-b border-gray-50 dark:border-neutral-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 ${isCancelled ? 'opacity-60 bg-gray-50 dark:bg-neutral-800/50' : ''}`}>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-500 whitespace-nowrap align-top">
                                                        {activeTab === 'daily'
                                                            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                            : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-sm">
                                                        {/* Items Summary (Primary Info) */}
                                                        <span className="font-medium text-gray-800 dark:text-neutral-200 block line-clamp-2" title={itemsSummary}>
                                                            {itemsSummary}
                                                        </span>

                                                        {/* Customer / Table Info (Secondary) */}
                                                        {(order.customerName || order.tableNumber) && (
                                                            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5 flex items-center gap-2">
                                                                {order.customerName && <span>👤 {order.customerName}</span>}
                                                                {order.tableNumber && <span>🍽️ Table {order.tableNumber}</span>}
                                                            </div>
                                                        )}

                                                        {/* ID & Status (Tertiary) */}
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="font-mono text-[10px] text-gray-300 dark:text-neutral-600">#{order.id.slice(0, 5)}</span>

                                                            {isCancelled && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400">
                                                                    Cancelled
                                                                </span>
                                                            )}
                                                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 capitalize">
                                                                    {order.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 capitalize text-gray-600 dark:text-neutral-400">
                                                        {order.paymentMethod || '-'}
                                                        {order.paymentStatus === 'pending_confirmation' && <span className="text-orange-500 dark:text-orange-400 text-xs ml-1">(Pending)</span>}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-medium ${isCancelled ? 'line-through text-gray-400 dark:text-neutral-600' : 'dark:text-neutral-200'}`}>
                                                        {formatCurrency(order.total)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!loading && orders.length === 0 && (
                                            <tr><td colSpan={4} className="p-12 text-center text-gray-400 dark:text-neutral-600">No orders found for this period.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalOrdersCount > ITEMS_PER_PAGE && (
                                <div className="border-t border-gray-100 dark:border-neutral-800 p-3 flex justify-between items-center bg-gray-50 dark:bg-neutral-900">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1 || loading}
                                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-neutral-700"
                                    >
                                        <ChevronLeft size={14} /> Previous
                                    </button>
                                    <span className="text-xs text-gray-500 dark:text-neutral-500 font-medium">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages || loading}
                                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-neutral-700"
                                    >
                                        Next <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* PRINT ONLY VIEW - FINANCE STYLE COMPACT */}
            <div className="hidden print:block bg-white text-black p-0 h-auto">
                <div className="border-b-2 border-black pb-4 mb-4">
                    <div className="flex justify-between items-end">
                        <div className="text-left">
                            <h1 className="text-3xl font-bold uppercase tracking-tight">Sales Report</h1>
                            <p className="text-sm font-medium mt-1">
                                {activeTab === 'daily' && `Daily Report: ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
                                {activeTab === 'weekly' && `Weekly Report: Week of ${new Date(selectedWeekStart).toLocaleDateString()}`}
                                {activeTab === 'monthly' && `Monthly Report: ${selectedMonth}`}
                            </p>
                        </div>
                        <div className="text-right text-xs">
                            <p>Generated: {new Date().toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {summary && (
                    <div className="flex w-full border-b border-black pb-4 mb-6">
                        <div className="flex-1 pr-4 border-r border-gray-300 last:border-0 last:pr-0">
                            <p className="text-xs uppercase text-gray-500 font-bold">Total Sales</p>
                            <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
                        </div>
                        <div className="flex-1 px-4 border-r border-gray-300">
                            <p className="text-xs uppercase text-gray-500 font-bold">Orders</p>
                            <p className="text-2xl font-bold">{summary.totalOrders}</p>
                        </div>
                        <div className="flex-1 px-4 border-r border-gray-300">
                            <p className="text-xs uppercase text-gray-500 font-bold">Avg Ticket</p>
                            <p className="text-2xl font-bold">{formatCurrency(summary.averageOrderValue)}</p>
                        </div>
                        <div className="flex-1 px-4">
                            <p className="text-xs uppercase text-gray-500 font-bold">Cancelled</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {summary.cancelledOrders} <span className="text-xs font-normal">({formatCurrency(summary.cancelledValue)})</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Print View Payment Breakdown */}
                {summary && summary.paymentBreakdown && (
                    <div className="mb-6">
                        <h4 className="text-sm font-bold uppercase border-b border-black mb-2 pb-1">Payment Breakdown</h4>
                        <div className="flex gap-4">
                            {Object.entries(summary.paymentBreakdown).map(([method, amount]) => (
                                <div key={method} className="flex-1 border-r border-gray-200 last:border-0 pr-4">
                                    <p className="text-xs uppercase text-gray-500 font-bold">{method.replace('_', ' ')}</p>
                                    <p className="text-lg font-bold">{formatCurrency(amount)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Print View Items Sales */}
                {itemsSummary.length > 0 && (
                    <div className="mb-6 break-inside-avoid">
                        <h4 className="text-sm font-bold uppercase border-b border-black mb-2 pb-1">Top Selling Products</h4>
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="border-b border-gray-800">
                                    <th className="py-1 w-8">#</th>
                                    <th className="py-1">Product</th>
                                    <th className="py-1 text-right w-16">Qty</th>
                                    <th className="py-1 text-right w-24">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {itemsSummary.slice(0, 15).map((item, index) => ( // Show top 15 in print
                                    <tr key={item.id} className="border-b border-gray-200">
                                        <td className="py-1 font-mono text-gray-500">{index + 1}</td>
                                        <td className="py-1 font-medium">{item.name}</td>
                                        <td className="py-1 text-right font-mono">{item.quantity}</td>
                                        <td className="py-1 text-right font-medium">{formatCurrency(item.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Note: Payment Breakdown is currently empty for Server-Side stats. We omit it for now or show total. */}
                {/* To restore it, we'd need to fetch a specialized breakdown or do client side aggregation on the limited set (which is wrong). */}
                {/* We just omit it in Print for Phase 2 as per Tradeoff. */}

                <div className="flex gap-8 items-start">
                    <div className="flex-1">
                        <h4 className="text-sm font-bold uppercase border-b border-black mb-2 pb-1">Detailed Log (First 100)</h4>
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="border-b border-gray-800">
                                    <th className="py-1 w-16">Time</th>
                                    <th className="py-1 w-20">ID</th>
                                    <th className="py-1">Items</th>
                                    <th className="py-1 text-right w-24">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.slice(0, 100).map(order => {
                                    const date = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt);
                                    const itemsSummary = order.items.map(i => `${i.quantity} ${i.name}`).join(', ');

                                    return (
                                        <tr key={order.id} className="border-b border-gray-200">
                                            <td className="py-1 font-mono text-gray-600">
                                                {activeTab === 'daily'
                                                    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                }
                                            </td>
                                            <td className="py-1 font-mono">
                                                {order.id.slice(0, 8)}
                                            </td>
                                            <td className="py-1 truncate max-w-[200px] text-gray-700">
                                                {itemsSummary}
                                                {order.status === 'cancelled' && <span className="ml-2 font-bold text-black">(CANCELLED)</span>}
                                            </td>
                                            <td className="py-1 text-right font-mono">
                                                {formatCurrency(order.total)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {totalOrdersCount > 100 && (
                            <p className="text-xs text-center mt-2 italic text-gray-500">... and {(totalOrdersCount - 100)} more orders (truncated for print)</p>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

function getStartOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}
