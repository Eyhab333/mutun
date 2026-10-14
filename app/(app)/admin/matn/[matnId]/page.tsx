import { Suspense } from "react";

import { MatnStructureWorkspace } from "@/components/admin/matn-structure/matn-structure-workspace";
import { PageHeader } from "@/components/app-shell/page-header";

export default function MatnStructurePage() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="بنية المتن"
        description="إدارة المقاصد والأبواب والفصول وفق بنية المتن المحددة."
      />
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">
            جارٍ تحميل بنية المتن...
          </p>
        }
      >
        <MatnStructureWorkspace />
      </Suspense>
    </section>
  );
}
