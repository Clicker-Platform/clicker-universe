import { Skeleton } from "@/components/ui/skeleton"

export function InboxSkeleton() {
    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-5 w-96" />
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
                {/* List Skeleton */}
                <div className="w-full lg:w-1/3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-3 rounded-xl border border-gray-100 dark:border-neutral-800">
                                <div className="flex justify-between mb-2">
                                    <Skeleton className="h-5 w-32 rounded" />
                                    <Skeleton className="h-4 w-12 rounded" />
                                </div>
                                <Skeleton className="h-4 w-3/4 mb-2 rounded" />
                                <Skeleton className="h-3 w-1/2 rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail Skeleton */}
                <div className="hidden lg:block flex-1 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-8">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-neutral-800 pb-6">
                            <Skeleton className="w-16 h-16 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48 rounded" />
                                <Skeleton className="h-4 w-32 rounded" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-2/3 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
