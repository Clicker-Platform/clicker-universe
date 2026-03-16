import { Skeleton } from "@/components/ui/skeleton"

export function ReservationSkeleton() {
    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Skeleton className="h-9 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-24 rounded-lg" />
                    <Skeleton className="h-10 w-40 rounded-lg" />
                </div>
            </div>

            {/* Unified Container Skeleton */}
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-neutral-800 h-[700px]">
                {/* List Column */}
                <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
                    {/* List Header/Tabs */}
                    <div className="p-4 border-b border-gray-100 dark:border-neutral-800 space-y-4">
                        <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl">
                            <Skeleton className="h-9 flex-1 rounded-lg" />
                            <Skeleton className="h-9 flex-1 rounded-lg" />
                            <Skeleton className="h-9 flex-1 rounded-lg" />
                            <Skeleton className="h-9 flex-1 rounded-lg" />
                        </div>
                    </div>
                    {/* List Items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="w-8 h-8 rounded-full" />
                                        <Skeleton className="h-5 w-32" />
                                    </div>
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail Column */}
                <div className="lg:col-span-2 h-full bg-white dark:bg-neutral-900 p-8 flex flex-col justify-center items-center">
                    <div className="w-full max-w-lg space-y-6">
                        <div className="flex items-center gap-4 mb-8">
                            <Skeleton className="w-20 h-20 rounded-full" />
                            <div className="space-y-3 flex-1">
                                <Skeleton className="h-8 w-3/4" />
                                <Skeleton className="h-5 w-1/2" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full rounded-xl" />
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-12 w-full rounded-xl" />
                                <Skeleton className="h-12 w-full rounded-xl" />
                            </div>
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
