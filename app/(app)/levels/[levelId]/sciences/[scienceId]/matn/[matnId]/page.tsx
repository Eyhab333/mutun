import { Suspense } from "react";

import {
  MatnReader,
  type ReaderSelection,
} from "@/components/levels/matn-reader";

type SearchParams = Record<string, string | string[] | undefined>;

function getOptionalParam(searchParams: SearchParams, name: string) {
  const value = searchParams[name];

  return typeof value === "string" ? value : undefined;
}

type MatnPageProps = {
  params: Promise<{ levelId: string; scienceId: string; matnId: string }>;
  searchParams: Promise<SearchParams>;
};

export default function MatnPage({ params, searchParams }: MatnPageProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <MatnContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function MatnContent({
  params,
  searchParams,
}: MatnPageProps) {
  const [{ levelId, scienceId, matnId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const maqsadId = getOptionalParam(resolvedSearchParams, "maqsadId");
  const chapterId = getOptionalParam(resolvedSearchParams, "chapterId");
  const sectionId = getOptionalParam(resolvedSearchParams, "sectionId");
  const passageId = getOptionalParam(resolvedSearchParams, "passageId");
  const initialSelection: ReaderSelection = {
    ...(maqsadId ? { maqsadId } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(passageId ? { passageId } : {}),
  };

  return (
    <MatnReader
      levelId={levelId}
      scienceId={scienceId}
      matnId={matnId}
      initialSelection={initialSelection}
    />
  );
}

function RouteFallback() {
  return <div className="min-h-40" aria-busy="true" />;
}
