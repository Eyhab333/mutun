import { ContentWorkspace } from "@/components/admin/content-workspace";
import { PageHeader } from "@/components/app-shell/page-header";

export default function AdminPage() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="إدارة المحتوى"
        description="نظّم المستويات والعلوم والمتون في مسار واحد واضح."
      />
      <ContentWorkspace />
    </section>
  );
}
