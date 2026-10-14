import { Suspense } from "react";

import { ReviewFocusPage } from "@/components/review/review-focus-page";
import { parseReviewFocusRouteRequest } from "@/lib/review-focus-route";

type ReviewFocusRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ReviewFocusRoute({ searchParams }: ReviewFocusRouteProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ReviewFocusRouteContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewFocusRouteContent({ searchParams }: ReviewFocusRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <ReviewFocusPage
      request={parseReviewFocusRouteRequest(resolvedSearchParams)}
    />
  );
}

function RouteFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}
