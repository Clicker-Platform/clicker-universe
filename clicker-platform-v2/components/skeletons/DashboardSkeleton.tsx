import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                {/* Refresh controls skeleton */}
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>

            {/* Content Overview */}
            <Skeleton className="h-8 w-40 mb-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border-[3px] border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <Skeleton className="w-5 h-5 rounded" />
                            <Skeleton className="h-5 w-24 rounded" />
                        </div>
                        <Skeleton className="h-10 w-16 mt-2 rounded" />
                    </div>
                ))}
            </div>

            {/* Top Performers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Links */}
                <div>
                    <Skeleton className="h-8 w-32 mb-4" />
                    <div className="bg-white rounded-3xl border-[3px] border-gray-100 overflow-hidden">
                        <div className="divide-y divide-gray-100">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="p-4 flex items-center justify-between">
                                    <div className="flex-1 pr-4">
                                        <Skeleton className="h-5 w-32 mb-1 rounded" />
                                        <Skeleton className="h-4 w-48 rounded" />
                                    </div>
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Products */}
                <div>
                    <Skeleton className="h-8 w-32 mb-4" />
                    <div className="bg-white rounded-3xl border-[3px] border-gray-100 overflow-hidden">
                        <div className="divide-y divide-gray-100">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 pr-4">
                                        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                                        <div className="space-y-1 w-full">
                                            <Skeleton className="h-5 w-32 rounded" />
                                            <Skeleton className="h-4 w-16 rounded" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
