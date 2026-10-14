"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, LoaderCircle } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LearnerBreadcrumbItem = {
  label: string;
  href?: string;
};

type LearnerPageProps = {
  title: string;
  description?: string;
  breadcrumbs?: readonly LearnerBreadcrumbItem[];
  children: ReactNode;
};

export function LearnerPage({
  title,
  description,
  breadcrumbs = [],
  children,
}: LearnerPageProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 pb-28 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader title={title} description={description ?? ""} />

      {breadcrumbs.length > 0 ? (
        <nav
          aria-label="مسار التصفح"
          className="mt-5 flex min-w-0 items-center gap-1 overflow-hidden text-sm text-muted-foreground"
        >
          {breadcrumbs.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronLeft className="size-3.5 shrink-0 rtl:rotate-180" /> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="truncate rounded-sm px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate px-1 py-0.5 text-foreground">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      ) : null}

      <div className="mt-8">{children}</div>
    </section>
  );
}

type LearnerListItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  href: string;
};

type LearnerListProps = {
  items: readonly LearnerListItem[];
  emptyMessage: string;
};

export function LearnerList({ items, emptyMessage }: LearnerListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-5 py-8 text-sm leading-7 text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
          >
            <div className="min-w-0 space-y-1">
              <h2 className="truncate font-medium text-foreground">{item.title}</h2>
              {item.description ? (
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {item.meta ? (
                <p className="text-xs text-muted-foreground">{item.meta}</p>
              ) : null}
            </div>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function LearnerLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center gap-2 rounded-xl border bg-card px-4 py-8 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function LearnerError({
  onRetry,
  className,
}: {
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-6",
        className
      )}
    >
      <p className="text-sm leading-7 text-muted-foreground">
        تعذر تحميل هذا المحتوى. يرجى المحاولة مرة أخرى.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        إعادة المحاولة
      </Button>
    </div>
  );
}

export function LearnerNotFound({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed px-5 py-8 text-sm leading-7 text-muted-foreground">
      {message}
    </p>
  );
}
