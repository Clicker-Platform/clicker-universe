import React from 'react';

export function TableSkeleton() {
    return (
        <div className="w-full animate-pulse">
            {/* Page Title Skeleton */}
            <div className="h-10 w-64 bg-gray-200 dark:bg-neutral-700 rounded mb-8"></div>

            {/* Add Button/Form Skeleton */}
            <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-2xl mb-8"></div>

            {/* List/Grid Skeleton */}
            <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-gray-200 dark:bg-neutral-700 rounded-xl border border-gray-200 dark:border-neutral-700"></div>
                ))}
            </div>
        </div>
    );
}
