import React from 'react';
import { Skeleton } from "@/components/ui/skeleton"

export function AdminShellSkeleton() {
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
            {/* Sidebar Skeleton */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 p-6 h-screen sticky top-0">
                <div className="flex items-center gap-3 mb-10">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded" />
                </div>
                <div className="space-y-4 flex-1">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-12 w-full rounded-xl mt-auto" />
            </aside>

            {/* Mobile Header Skeleton */}
            <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded" />
                </div>
                <Skeleton className="w-8 h-8 rounded" />
            </div>

            {/* Main Content Area Skeleton */}
            <main className="flex-1 p-4 md:p-8">
                <Skeleton className="h-10 w-48 rounded mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                </div>
            </main>
        </div>
    );
}
