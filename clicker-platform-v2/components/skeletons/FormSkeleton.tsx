import React from 'react';

export function FormSkeleton() {
    return (
        <div className="max-w-4xl animate-pulse">
            {/* Page Title Skeleton */}
            <div className="h-10 w-64 bg-gray-200 dark:bg-neutral-700 rounded mb-8"></div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Container Skeleton */}
                <div className="space-y-6 bg-white dark:bg-neutral-900 p-8 rounded-3xl border-[3px] border-gray-100 dark:border-neutral-800 shadow-sm h-fit">

                    {/* Input Field Skeletons */}
                    {[1, 2, 3].map((i) => (
                        <div key={i}>
                            <div className="h-5 w-32 bg-gray-200 dark:bg-neutral-700 rounded mb-2"></div>
                            <div className="h-12 w-full bg-gray-200 dark:bg-neutral-700 rounded-xl"></div>
                        </div>
                    ))}

                    {/* Textarea Skeleton */}
                    <div>
                        <div className="h-5 w-32 bg-gray-200 dark:bg-neutral-700 rounded mb-2"></div>
                        <div className="h-32 w-full bg-gray-200 dark:bg-neutral-700 rounded-xl"></div>
                    </div>

                    {/* Button Skeleton */}
                    <div className="h-14 w-full bg-gray-200 dark:bg-neutral-700 rounded-xl mt-4"></div>
                </div>

                {/* Live Preview Skeleton */}
                <div className="space-y-6">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-neutral-700 rounded"></div>

                    {/* Theme Preview Card Skeleton */}
                    <div className="w-full aspect-[4/5] bg-gray-200 dark:bg-neutral-700 rounded-3xl border-[3px] border-gray-100 dark:border-neutral-800"></div>

                    {/* Smaller Preview Card */}
                    <div className="w-full h-32 bg-gray-200 dark:bg-neutral-700 rounded-2xl border border-gray-100 dark:border-neutral-800"></div>
                </div>
            </div>
        </div>
    );
}
