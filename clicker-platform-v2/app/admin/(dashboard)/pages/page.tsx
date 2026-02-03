'use client';
import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from 'next/link';
import { Plus, Search, FileText } from 'lucide-react';
import { Page } from '@/data/mockData';
import { PagesSkeleton } from '@/components/skeletons/PagesSkeleton';

import { useSite } from '@/lib/site-context';

export default function PagesList() {
    const { siteId } = useSite();
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        const fetchPages = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "sites", siteId, "pages"));
                const fetchedPages = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Page));
                setPages(fetchedPages);
            } catch (error) {
                console.error("Error fetching pages:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPages();
    }, [siteId]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold font-heading text-brand-dark">Pages</h1>
                    <p className="text-gray-500">Create and manage your internal pages</p>
                </div>
                <Link
                    href="/admin/pages/create"
                    className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-colors"
                >
                    <Plus size={20} />
                    Create Page
                </Link>
            </div>

            {loading ? (
                <PagesSkeleton />
            ) : pages.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <FileText size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No pages yet</h3>
                    <p className="text-gray-500 mb-6">Start by creating your first page</p>
                    <Link
                        href="/admin/pages/create"
                        className="text-brand-dark font-bold hover:underline"
                    >
                        Create a page
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pages.map(page => (
                        <Link
                            key={page.id}
                            href={`/admin/pages/${page.id}`}
                            className="bg-white p-4 rounded-xl border-2 border-gray-100 hover:border-brand-dark transition-colors flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-brand-green/10 rounded-lg text-brand-dark">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 group-hover:text-brand-dark">{page.title}</h3>
                                    <p className="text-sm text-gray-500">/{page.slug}</p>
                                </div>
                            </div>
                            <div className="text-sm font-medium text-gray-400">
                                {new Date(page.updatedAt?.seconds * 1000).toLocaleDateString()}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
