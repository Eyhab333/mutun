import { Suspense } from "react";

import { RepairFocusPage } from "@/components/repair/repair-focus-page";
import { parseRepairFocusRouteRequest } from "@/lib/repair-focus-route";

type RepairFocusRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function RepairFocusRoute({ searchParams }: RepairFocusRouteProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RepairFocusRouteContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RepairFocusRouteContent({ searchParams }: RepairFocusRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <RepairFocusPage request={parseRepairFocusRouteRequest(resolvedSearchParams)} />
  );
}

function RouteFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}
