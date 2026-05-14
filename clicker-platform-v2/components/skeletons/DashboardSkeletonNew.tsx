import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeletonNew() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32 rounded" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Skeleton className="w-full lg:basis-[38%] lg:shrink-0 h-96 rounded-lg" />
        <Skeleton className="w-full lg:basis-[30%] lg:shrink-0 h-96 rounded-lg" />
        <Skeleton className="w-full lg:basis-[32%] lg:shrink-0 h-96 rounded-lg" />
      </div>
    </div>
  );
}
