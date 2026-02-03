import { Skeleton } from "@/components/ui/skeleton"

export function ProductsSkeleton() {
    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-32 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
            </div>

            {/* Featured Product Skeleton */}
            <div className="mb-12">
                <Skeleton className="h-7 w-40 mb-4" />
                <div className="relative h-64 md:h-80 rounded-3xl overflow-hidden bg-gray-100 border-[3px] border-gray-100">
                    <div className="absolute inset-0 p-8 flex flex-col justify-end">
                        <Skeleton className="h-8 w-3/4 mb-2 max-w-md rounded" />
                        <Skeleton className="h-6 w-1/2 max-w-xs rounded" />
                    </div>
                </div>
            </div>

            {/* Products Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border-[3px] border-gray-100 overflow-hidden flex flex-col h-full">
                        <div className="aspect-square relative bg-gray-50">
                            <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <Skeleton className="h-5 w-24 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                            <Skeleton className="h-6 w-3/4 mb-2 rounded" />
                            <Skeleton className="h-5 w-1/2 rounded" />
                            <div className="mt-auto pt-4 flex gap-2">
                                <Skeleton className="h-9 flex-1 rounded-lg" />
                                <Skeleton className="h-9 w-9 rounded-lg" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
