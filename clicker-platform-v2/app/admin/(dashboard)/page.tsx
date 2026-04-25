'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { Eye, MousePointer2, TrendingUp, Link as LinkIcon, ShoppingBag } from 'lucide-react';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { useSite } from '@/lib/site-context';
import { getSiteStatsTotals } from '@/lib/analytics/counters';
import { logger } from '@/lib/logger';

interface DashboardLink {
    id: string;
    title: string;
    url?: string;
    clicks?: number;
}

interface DashboardProduct {
    id: string;
    title: string;
    price?: string;
    image?: string;
    clicks?: number;
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const { siteId } = useSite();
    const [stats, setStats] = useState({
        linksCount: 0,
        productsCount: 0,
        pageViews: 0,
        totalClicks: 0
    });
    const [topLinks, setTopLinks] = useState<DashboardLink[]>([]);
    const [topProducts, setTopProducts] = useState<DashboardProduct[]>([]);

    useEffect(() => {
        if (!siteId) return;

        setLoading(true);

        // One-shot counts (getCountFromServer doesn't support onSnapshot)
        Promise.all([
            getCountFromServer(collection(db, 'sites', siteId, 'links')),
            getCountFromServer(collection(db, 'sites', siteId, 'products')),
        ]).then(([linksCountSnap, productsCountSnap]) => {
            setStats(prev => ({
                ...prev,
                linksCount: linksCountSnap.data().count,
                productsCount: productsCountSnap.data().count,
            }));
        }).catch(err => logger.error('admin.dashboard.counts.failed', { siteId, error: err }));

        // Aggregated totals from distributed counter shards — polled every 60s
        const fetchTotals = async () => {
            try {
                const totals = await getSiteStatsTotals(siteId);
                setStats(prev => ({ ...prev, ...totals }));
            } catch (err) {
                logger.error('admin.dashboard.analytics.failed', { siteId, error: err });
            } finally {
                setLoading(false);
            }
        };
        fetchTotals();
        const totalsIntervalId = setInterval(fetchTotals, 60_000);

        // Real-time: top links by clicks
        const unsubLinks = onSnapshot(
            query(collection(db, 'sites', siteId, 'links'), orderBy('clicks', 'desc'), limit(3)),
            (snap) => {
                setTopLinks(snap.docs.map(d => ({
                    id: d.id,
                    title: d.data().title ?? 'Untitled',
                    url: d.data().url,
                    clicks: d.data().clicks,
                })));
            },
            (err) => logger.error('admin.dashboard.links.subscribe.failed', { siteId, error: err })
        );

        // Real-time: top products by clicks
        const unsubProducts = onSnapshot(
            query(collection(db, 'sites', siteId, 'products'), orderBy('clicks', 'desc'), limit(3)),
            (snap) => {
                setTopProducts(snap.docs.map(d => ({
                    id: d.id,
                    title: d.data().name ?? d.data().title ?? 'Untitled',
                    price: d.data().price,
                    image: d.data().image ?? d.data().imageUrl,
                    clicks: d.data().clicks,
                })));
            },
            (err) => logger.error('admin.dashboard.products.subscribe.failed', { siteId, error: err })
        );

        return () => {
            clearInterval(totalsIntervalId);
            unsubLinks();
            unsubProducts();
        };
    }, [siteId]);

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Dashboard</h1>
                <p className="text-gray-600 dark:text-neutral-400 font-medium">Welcome back! Manage your content below.</p>
            </div>

            {/* Content Overview */}
            <h2 className="text-xl font-bold mb-4 text-brand-dark flex items-center gap-2">
                <TrendingUp size={24} /> Content Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3 mb-2 text-brand-dark/70">
                        <LinkIcon size={20} /> <span className="font-bold">Total Links</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900 dark:text-neutral-100">{stats.linksCount}</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3 mb-2 text-brand-dark/70">
                        <ShoppingBag size={20} /> <span className="font-bold">Products</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900 dark:text-neutral-100">{stats.productsCount}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3 mb-2 text-blue-600">
                        <Eye size={20} /> <span className="font-bold">Total Page Views</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900 dark:text-neutral-100">{stats.pageViews}</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">All time</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3 mb-2 text-green-700 dark:text-neutral-300">
                        <MousePointer2 size={20} /> <span className="font-bold">Total Clicks</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900 dark:text-neutral-100">{stats.totalClicks}</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">All time</p>
                </div>
            </div>

            {/* Top Performers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Top Links */}
                <div>
                    <h2 className="text-xl font-bold mb-4 text-brand-dark flex items-center gap-2">
                        Top Links <span className="text-sm font-normal text-gray-500 dark:text-neutral-500">(by clicks)</span>
                    </h2>
                    <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                        {topLinks.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-gray-500 dark:text-neutral-500 mb-2">No links yet.</p>
                                <Link href="/admin/links" className="text-sm text-studio-blue hover:underline font-medium">
                                    Add your first link →
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {topLinks.map(data => (
                                    <div key={data.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-bold text-brand-dark truncate">{data.title}</p>
                                            <p className="text-sm text-gray-500 dark:text-neutral-500 truncate">{data.url}</p>
                                        </div>
                                        <div className="bg-brand-green/20 text-brand-dark px-3 py-1 rounded-full font-bold text-sm">
                                            {data.clicks ?? 0} clicks
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
                    <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                        {topProducts.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-gray-500 dark:text-neutral-500 mb-2">No products yet.</p>
                                <Link href="/admin/products" className="text-sm text-studio-blue hover:underline font-medium">
                                    Add your first product →
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {topProducts.map(data => (
                                    <div key={data.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800">
                                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                                            {data.image && (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-neutral-700">
                                                    <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-brand-dark truncate">{data.title}</p>
                                                <p className="text-sm text-gray-500 dark:text-neutral-500">{data.price}</p>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-bold text-sm">
                                            {data.clicks ?? 0} clicks
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
