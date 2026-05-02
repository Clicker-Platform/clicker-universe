import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeletonNew() {
  return (
    <div>
      <Skeleton className="h-28 rounded-xl mb-6" />

      <Skeleton className="h-4 w-16 mb-3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-4 w-28 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-4 w-40 mb-3" />
      <Skeleton className="h-16 rounded-lg" />
    </div>
  );
}
