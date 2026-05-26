"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/8bit/skeleton";

export function PageSkeleton({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Hero skeleton */}
        <div className="mb-16 flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-3 w-80" />
          <div className="flex gap-3 mt-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
          <Skeleton className="mt-6 h-28 w-28" />
        </div>

        {/* Separator */}
        <Skeleton className="mb-16 h-0.5 w-full" />

        {/* Terminal skeleton */}
        <div className="mb-16 border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-2.5 w-2.5" />
            <Skeleton className="h-2.5 w-2.5" />
            <Skeleton className="h-2.5 w-2.5" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Separator */}
        <Skeleton className="mb-16 h-0.5 w-full" />

        {/* Shortcuts skeleton */}
        <div className="mb-16 text-center">
          <Skeleton className="mx-auto mb-4 h-5 w-36" />
          <div className="flex flex-wrap justify-center gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-28" />
            ))}
          </div>
        </div>

        {/* Features skeleton */}
        <div className="mb-16">
          <Skeleton className="mx-auto mb-4 h-5 w-24" />
          <Skeleton className="mx-auto mb-8 h-3 w-56" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 border-b border-border pb-3">
                <Skeleton className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function DocsSkeleton({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Back link */}
        <Skeleton className="mb-8 h-4 w-16" />

        {/* Title */}
        <div className="mb-12 text-center">
          <Skeleton className="mx-auto mb-2 h-8 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>

        {/* Grid cards */}
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

  return <>{children}</>;
}
