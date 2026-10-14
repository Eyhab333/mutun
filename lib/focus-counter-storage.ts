import { getSafeStorageSegment } from "@/lib/firestore/deterministic-ids";

export type FocusCounterIdentity = {
  userId: string;
  passageId: string;
  matnId: string;
  dateKey: string;
};

export type FocusCounterDraft = FocusCounterIdentity & {
  version: 1;
  count: number;
  syncedCount: number;
  dirty: boolean;
  updatedAt: string;
};

function hasValidCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function getFocusCounterStorageKey({
  userId,
  passageId,
  dateKey,
}: FocusCounterIdentity) {
  return [
    "mutun:focus-counter:v1",
    `u-${getSafeStorageSegment(userId)}`,
    `p-${getSafeStorageSegment(passageId)}`,
    `d-${getSafeStorageSegment(dateKey)}`,
  ].join(":");
}

function isMatchingDraft(
  value: unknown,
  identity: FocusCounterIdentity
): value is FocusCounterDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Partial<FocusCounterDraft>;

  return (
    draft.version === 1 &&
    draft.userId === identity.userId &&
    draft.passageId === identity.passageId &&
    draft.matnId === identity.matnId &&
    draft.dateKey === identity.dateKey &&
    hasValidCount(draft.count) &&
    hasValidCount(draft.syncedCount) &&
    typeof draft.dirty === "boolean" &&
    typeof draft.updatedAt === "string"
  );
}

export function getFocusCounterDraft(identity: FocusCounterIdentity) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = getFocusCounterStorageKey(identity);

  try {
    const rawValue = window.localStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (isMatchingDraft(parsedValue, identity)) {
      return parsedValue;
    }
  } catch {
    // The exact malformed key is removed below.
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Local storage may be unavailable; the caller can still keep in-memory state.
  }

  return null;
}

export function saveFocusCounterDraft(draft: FocusCounterDraft) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(
      getFocusCounterStorageKey(draft),
      JSON.stringify(draft)
    );
    return true;
  } catch {
    return false;
  }
}

export function removeFocusCounterDraft(identity: FocusCounterIdentity) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getFocusCounterStorageKey(identity));
  } catch {
    // Local storage may be unavailable.
  }
}
