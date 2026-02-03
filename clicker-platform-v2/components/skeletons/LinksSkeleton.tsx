import { Skeleton } from "@/components/ui/skeleton"

export function LinksSkeleton() {
    return (
        <div className="max-w-4xl">
            <Skeleton className="h-10 w-48 mb-8" />

            {/* Add/Edit Link Form Skeleton */}
            <div className="bg-white p-6 rounded-2xl border-[3px] border-brand-dark shadow-sm mb-8">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 flex gap-4 mb-2">
                        <Skeleton className="h-10 w-32 rounded-xl" />
                        <Skeleton className="h-10 w-32 rounded-xl" />
                        <Skeleton className="h-10 w-32 rounded-xl" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg md:col-span-2" />

                    <div className="md:col-span-2">
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>

                    <div className="md:col-span-2">
                        <Skeleton className="h-10 w-full rounded-lg mb-1" />
                    </div>

                    <div className="md:col-span-2 flex gap-2">
                        <Skeleton className="h-10 w-24 rounded-lg" />
                    </div>
                </div>
            </div>

            {/* Links List Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Skeleton className="h-5 w-32 rounded" />
                                    <Skeleton className="h-4 w-12 rounded" />
                                </div>
                                <Skeleton className="h-4 w-48 rounded" />
                                <Skeleton className="h-3 w-24 mt-1 rounded" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="w-9 h-9 rounded-lg" />
                            <Skeleton className="w-9 h-9 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
