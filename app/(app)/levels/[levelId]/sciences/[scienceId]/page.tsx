import { Suspense } from "react";

import { ScienceMatn } from "@/components/levels/science-matn";

type SciencePageProps = {
  params: Promise<{ levelId: string; scienceId: string }>;
};

export default function SciencePage({ params }: SciencePageProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ScienceContent params={params} />
    </Suspense>
  );
}

async function ScienceContent({
  params,
}: SciencePageProps) {
  const { levelId, scienceId } = await params;

  return <ScienceMatn levelId={levelId} scienceId={scienceId} />;
}

function RouteFallback() {
  return <div className="min-h-40" aria-busy="true" />;
}
