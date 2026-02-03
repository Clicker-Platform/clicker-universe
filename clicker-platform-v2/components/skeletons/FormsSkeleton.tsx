import { Skeleton } from "@/components/ui/skeleton"

export function FormsSkeleton() {
    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <Skeleton className="h-12 w-40 rounded-xl" />
            </div>

            {/* Forms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border-[3px] border-gray-100 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <Skeleton className="w-12 h-12 rounded-xl" />
                            <Skeleton className="w-8 h-8 rounded-lg" />
                        </div>
                        <Skeleton className="h-6 w-3/4 mb-2 rounded" />
                        <Skeleton className="h-4 w-full mb-4 rounded" />

                        <div className="mt-auto pt-4 border-t border-gray-50 flex justify-between">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
