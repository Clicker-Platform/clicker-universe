'use client';

import type { ReactNode } from 'react';

interface Props {
  inbox: ReactNode;
  pages: ReactNode;
  modules: ReactNode;
}

export function OverviewLayout({ inbox, pages, modules }: Props) {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Overview</h1>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="w-full lg:basis-[38%] lg:shrink-0">{inbox}</section>
        <section className="w-full lg:basis-[30%] lg:shrink-0">{pages}</section>
        <section className="w-full lg:basis-[32%] lg:shrink-0">{modules}</section>
      </div>
    </div>
  );
}
