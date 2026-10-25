import type { ReactNode } from "react";

import { PageHeader } from "./page-header";

type PageContentProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageContent({
  title,
  description,
  children,
}: PageContentProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader title={title} description={description} />
      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}
