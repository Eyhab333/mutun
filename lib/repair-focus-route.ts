export type RepairFocusRouteRequest = {
  matnId: string;
  passageIds: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleSearchParam(searchParams: SearchParams, key: string) {
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

export function createRepairFocusHref(request: RepairFocusRouteRequest) {
  const searchParams = new URLSearchParams({
    matn: request.matnId,
    passages: request.passageIds.join(","),
  });

  return `/repair/focus?${searchParams.toString()}`;
}

export function parseRepairFocusRouteRequest(
  searchParams: SearchParams
): RepairFocusRouteRequest | null {
  const matnId = getSingleSearchParam(searchParams, "matn");
  const passageIds = parseIds(getSingleSearchParam(searchParams, "passages"));

  return matnId && passageIds ? { matnId, passageIds } : null;
}
