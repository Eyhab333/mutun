import { Suspense } from "react";

import { LevelSciences } from "@/components/levels/level-sciences";

type LevelPageProps = {
  params: Promise<{ levelId: string }>;
};

export default function LevelPage({ params }: LevelPageProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <LevelContent params={params} />
    </Suspense>
  );
}

async function LevelContent({
  params,
}: LevelPageProps) {
  const { levelId } = await params;

  return <LevelSciences levelId={levelId} />;
}

function RouteFallback() {
  return <div className="min-h-40" aria-busy="true" />;
}
