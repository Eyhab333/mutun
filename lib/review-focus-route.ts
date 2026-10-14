import type { ReviewStage } from "@/types";

const reviewStages = new Set<ReviewStage>([
  "AFTER_7_DAYS",
  "AFTER_30_DAYS",
  "MONTHLY",
]);

export type ReviewFocusRouteRequest = {
  matnId: string;
  reviewStage: ReviewStage;
  sourceReviewGroupIds: string[];
  sourceReviewGroupDueAts: string[];
  passageIds: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleSearchParam(
  searchParams: SearchParams,
  key: string
): string | null {
  const value = searchParams[key];

  return typeof value === "string" ? value : null;
}

function parseIds(value: string | null) {
  if (!value) {
    return null;
  }

  const ids = value.split(",").filter(Boolean);

  return ids.length > 0 && new Set(ids).size === ids.length ? ids : null;
}

function parseDueAts(value: string | null) {
  if (!value) {
    return null;
  }

  const dueAts = value.split(",");

  return dueAts.length > 0 && dueAts.every((dueAt) => {
    const date = new Date(dueAt);

    return !Number.isNaN(date.getTime()) && date.toISOString() === dueAt;
  })
    ? dueAts
    : null;
}

export function createReviewFocusHref(request: ReviewFocusRouteRequest) {
  const searchParams = new URLSearchParams({
    matn: request.matnId,
    stage: request.reviewStage,
    groups: request.sourceReviewGroupIds.join(","),
    due: request.sourceReviewGroupDueAts.join(","),
    passages: request.passageIds.join(","),
  });

  return `/review/focus?${searchParams.toString()}`;
}

export function parseReviewFocusRouteRequest(
  searchParams: SearchParams
): ReviewFocusRouteRequest | null {
  const matnId = getSingleSearchParam(searchParams, "matn");
  const reviewStage = getSingleSearchParam(searchParams, "stage");
  const sourceReviewGroupIds = parseIds(getSingleSearchParam(searchParams, "groups"));
  const sourceReviewGroupDueAts = parseDueAts(getSingleSearchParam(searchParams, "due"));
  const passageIds = parseIds(getSingleSearchParam(searchParams, "passages"));

  if (
    !matnId ||
    !reviewStage ||
    !reviewStages.has(reviewStage as ReviewStage) ||
    !sourceReviewGroupIds ||
    !sourceReviewGroupDueAts ||
    sourceReviewGroupDueAts.length !== sourceReviewGroupIds.length ||
    !passageIds
  ) {
    return null;
  }

  return {
    matnId,
    reviewStage: reviewStage as ReviewStage,
    sourceReviewGroupIds,
    sourceReviewGroupDueAts,
    passageIds,
  };
}
