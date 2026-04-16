import { Skeleton } from "@/components/ui/skeleton";

export function InventorySkeleton() {
    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-100 dark:border-neutral-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 flex items-center justify-between">
                <Skeleton className="h-6 w-32 bg-gray-200 dark:bg-neutral-700" />
                <Skeleton className="h-8 w-24 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
            </div>
            <div className="p-0">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-800 last:border-0">
                        <div className="flex gap-4 items-center flex-1">
                            <Skeleton className="h-4 w-16 bg-gray-200 dark:bg-neutral-700" />
                            <div className="flex flex-col gap-2 flex-1">
                                <Skeleton className="h-5 w-48 bg-gray-200 dark:bg-neutral-700" />
                                <Skeleton className="h-3 w-24 bg-gray-100 dark:bg-neutral-800" />
                            </div>
                        </div>
                        <div className="flex gap-8 items-center">
                            <Skeleton className="h-8 w-16 bg-gray-200 dark:bg-neutral-700 rounded-md" />
                            <Skeleton className="h-6 w-12 bg-gray-200 dark:bg-neutral-700" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 bg-gray-200 dark:bg-neutral-700 rounded-md" />
                                <Skeleton className="h-8 w-8 bg-gray-200 dark:bg-neutral-700 rounded-md" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
