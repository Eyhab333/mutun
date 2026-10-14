import { PageHeader } from "./page-header";

type PageContentProps = {
  title: string;
  description: string;
};

export function PageContent({ title, description }: PageContentProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader title={title} description={description} />
    </section>
  );
}
