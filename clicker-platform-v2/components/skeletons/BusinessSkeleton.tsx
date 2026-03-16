import { Skeleton } from "@/components/ui/skeleton"

export function BusinessSkeleton() {
    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="flex items-center gap-3 mb-8">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="h-8 w-48 rounded" />
            </div>

            {/* Tabs Skeleton */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
                <Skeleton className="h-10 w-40 rounded-full" />
                <Skeleton className="h-10 w-40 rounded-full" />
                <Skeleton className="h-10 w-40 rounded-full" />
            </div>

            {/* Content Area Skeleton */}
            <div className="bg-white dark:bg-neutral-900 p-6 md:px-8 rounded-2xl border-[3px] border-gray-100 dark:border-neutral-800 min-h-[400px]">
                <Skeleton className="h-20 w-full mb-6 rounded-xl" />

                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <Skeleton className="h-5 w-32 mb-2 rounded" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Skeleton className="h-5 w-32 mb-2 rounded" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                        <div>
                            <Skeleton className="h-5 w-32 mb-2 rounded" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                    </div>
                    <div>
                        <Skeleton className="h-5 w-32 mb-2 rounded" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100 dark:border-neutral-800">
                    <Skeleton className="h-12 w-48 rounded-xl" />
                </div>
            </div>
        </div>
    )
}
