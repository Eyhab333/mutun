import { Suspense } from "react";

import { MobilePageMenu } from "./mobile-page-menu";

type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2">
        <Suspense
          fallback={<span aria-hidden="true" className="size-8 shrink-0 md:hidden" />}
        >
          <MobilePageMenu />
        </Suspense>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
      </div>

      <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
        {description}
      </p>
    </header>
  );
}

