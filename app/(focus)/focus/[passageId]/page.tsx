import { Suspense } from "react";

import { FocusPage } from "@/components/focus/focus-page";

type FocusRouteProps = {
  params: Promise<{ passageId: string }>;
};

export default function FocusRoute({ params }: FocusRouteProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <FocusRouteContent params={params} />
    </Suspense>
  );
}

async function FocusRouteContent({ params }: FocusRouteProps) {
  const { passageId } = await params;

  return <FocusPage passageId={passageId} />;
}

function RouteFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}
