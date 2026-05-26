import { Skeleton } from "@/components/ui/8bit/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Skeleton className="mb-8 h-4 w-16" />
      <div className="mb-12 text-center">
        <Skeleton className="mx-auto mb-2 h-8 w-48" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-2 border-border bg-card p-4">
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
