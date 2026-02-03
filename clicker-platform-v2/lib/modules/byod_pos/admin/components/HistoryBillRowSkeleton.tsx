import { Skeleton } from "@/components/ui/skeleton";

export function HistoryBillRowSkeleton() {
    return (
        <div className="border-b border-gray-100 last:border-0 p-4 flex items-center gap-4">
            {/* Icon Skeleton */}
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />

            <div className="flex-1 min-w-0 space-y-2">
                {/* Title & Badge Row */}
                <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16" />
                </div>
                {/* Date & Payment Row */}
                <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                </div>
            </div>

            {/* Price & Status Skeleton */}
            <div className="text-right space-y-1">
                <Skeleton className="h-6 w-24 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
            </div>

            {/* Chevron Skeleton */}
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
        </div>
    );
}
