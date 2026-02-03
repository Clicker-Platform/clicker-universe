import { Skeleton } from "@/components/ui/skeleton"

export function PagesSkeleton() {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Skeleton className="h-8 w-32 mb-1" />
                    <Skeleton className="h-5 w-48" />
                </div>
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>

            <div className="grid gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-4 rounded-xl border-2 border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-32 rounded" />
                                <Skeleton className="h-4 w-24 rounded" />
                            </div>
                        </div>
                        <Skeleton className="h-4 w-24 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}
