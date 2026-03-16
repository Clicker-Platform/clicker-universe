'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { Eye, MousePointer2, TrendingUp, Link as LinkIcon, ShoppingBag, Loader2 } from 'lucide-react';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { useSite } from '@/lib/site-context';

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const { siteId } = useSite();
    const [stats, setStats] = useState({
        linksCount: 0,
        productsCount: 0,
        pageViews: 0,
        totalClicks: 0
    });
    const [topLinks, setTopLinks] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);

    const fetchDashboardData = async (isRefresh = false) => {
        if (!siteId) return;
        if (isRefresh) setRefreshing(true);
        try {
            // Execute all fetches in parallel
            const [
                linksCountSnap,
                productsCountSnap,
                statsSnap,
                topLinksSnap,
                topProductsSnap
            ] = await Promise.all([
                // 1. Fetch Counts
                getCountFromServer(collection(db, 'sites', siteId, 'links')),
                getCountFromServer(collection(db, 'sites', siteId, 'products')),
                // 2. Fetch Analytics Stats
                getDoc(doc(db, 'sites', siteId, 'analytics', 'siteStats')),
                // 3. Fetch Top Performing Links (Limit 3)
                getDocs(query(collection(db, 'sites', siteId, 'links'), orderBy('clicks', 'desc'), limit(3))),
                // 4. Fetch Top Performing Products (Limit 3)
                getDocs(query(collection(db, 'sites', siteId, 'products'), orderBy('clicks', 'desc'), limit(3)))
            ]);

            const siteStats = statsSnap.exists() ? statsSnap.data() : { pageViews: 0, totalClicks: 0 };

            setStats({
                linksCount: linksCountSnap.data().count,
                productsCount: productsCountSnap.data().count,
                pageViews: siteStats.pageViews || 0,
                totalClicks: siteStats.totalClicks || 0
            });

            setTopLinks(topLinksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTopProducts(topProductsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLastUpdated(new Date());

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [siteId]);

    // Auto-refresh logic
    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        if (autoRefresh) {
            intervalId = setInterval(() => {
                fetchDashboardData(true);
            }, 30000); // 30 seconds
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [autoRefresh]);

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase">Dashboard</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Welcome back! Manage your content below.</p>
                </div>

                <div className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-2 rounded-xl border border-gray-100 dark:border-neutral-800/50 shadow-sm">
                    {lastUpdated && (
                        <p className="text-xs text-gray-400 dark:text-neutral-600 font-medium hidden sm:block">
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                    )}

                    <div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-1 hidden sm:block"></div>

                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${autoRefresh
                            ? 'bg-brand-green/10 text-brand-dark'
                            : 'bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-700'
                            }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        Auto
                    </button>

                    <button
                        onClick={() => fetchDashboardData(true)}
                        disabled={refreshing}
                        className="bg-brand-dark text-white p-2 rounded-lg hover:bg-brand-dark/90 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                        title="Refresh Data"
                    >
                        <Loader2 size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Content Overview */}
            <h2 className="text-xl font-bold mb-4 text-brand-dark flex items-center gap-2">
                <TrendingUp size={24} /> Content Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-brand-dark/70">
                        <LinkIcon size={20} /> <span className="font-bold">Total Links</span>
                    </div>
                    <p className="text-4xl font-black text-brand-dark">{stats.linksCount}</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-brand-dark/70">
                        <ShoppingBag size={20} /> <span className="font-bold">Products</span>
                    </div>
                    <p className="text-4xl font-black text-brand-dark">{stats.productsCount}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-blue-600">
                        <Eye size={20} /> <span className="font-bold">Total Page Views</span>
                    </div>
                    <p className="text-4xl font-black text-brand-dark">{stats.pageViews}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-green-700 dark:text-neutral-300">
                        <MousePointer2 size={20} /> <span className="font-bold">Total Clicks</span>
                    </div>
                    <p className="text-4xl font-black text-brand-dark">{stats.totalClicks}</p>
                </div>
            </div>

            {/* Top Performers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Top Links */}
                <div>
                    <h2 className="text-xl font-bold mb-4 text-brand-dark flex items-center gap-2">
                        Top Links <span className="text-sm font-normal text-gray-500 dark:text-neutral-500">(by clicks)</span>
                    </h2>
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                        {topLinks.length === 0 ? (
                            <p className="p-6 text-gray-500 dark:text-neutral-500 text-center">No data yet.</p>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {topLinks.map(data => (
                                    <div key={data.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-bold text-brand-dark truncate">{data.title}</p>
                                            <p className="text-sm text-gray-500 dark:text-neutral-500 truncate">{data.url}</p>
                                        </div>
                                        <div className="bg-brand-green/20 text-brand-dark px-3 py-1 rounded-full font-bold text-sm">
                                            {data.clicks || 0} clicks
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div>
                    <h2 className="text-xl font-bold mb-4 text-brand-dark flex items-center gap-2">
                        Top Products <span className="text-sm font-normal text-gray-500 dark:text-neutral-500">(by clicks)</span>
                    </h2>
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                        {topProducts.length === 0 ? (
                            <p className="p-6 text-gray-500 dark:text-neutral-500 text-center">No data yet.</p>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {topProducts.map(data => {
                                    const productName = data.name || data.title || 'Untitled';
                                    const productImage = data.imageUrl || data.image;

                                    return (
                                        <div key={data.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800">
                                            <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                                                {productImage && (
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-neutral-700">
                                                        <img src={productImage} alt={productName} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-brand-dark truncate">{productName}</p>
                                                    <p className="text-sm text-gray-500 dark:text-neutral-500">{data.price}</p>
                                                </div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-bold text-sm">
                                                {data.clicks || 0} clicks
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
