import type { BrowseResumeLocation } from "@/types";

export const browseResumeStorageKey = "mutun:browse-resume";

type BrowseResumeInput = Omit<BrowseResumeLocation, "version" | "updatedAt">;

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isBrowseResumeLocation(value: unknown): value is BrowseResumeLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const resume = value as Partial<BrowseResumeLocation>;

  return (
    resume.version === 1 &&
    typeof resume.levelId === "string" &&
    typeof resume.scienceId === "string" &&
    typeof resume.matnId === "string" &&
    typeof resume.updatedAt === "string" &&
    isOptionalString(resume.maqsadId) &&
    isOptionalString(resume.chapterId) &&
    isOptionalString(resume.sectionId) &&
    isOptionalString(resume.passageId) &&
    isOptionalString(resume.matnName) &&
    isOptionalString(resume.contextTitle)
  );
}

// This stores the last library location only; it is not learning progress.
export function readBrowseResume() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(browseResumeStorageKey);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (isBrowseResumeLocation(parsed)) {
      return parsed;
    }

    window.localStorage.removeItem(browseResumeStorageKey);
  } catch {
    // Invalid or unavailable local storage must not block library browsing.
  }

  return null;
}

export function writeBrowseResume(input: BrowseResumeInput) {
  if (typeof window === "undefined") {
    return;
  }

  const resume: BrowseResumeLocation = {
    ...input,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(browseResumeStorageKey, JSON.stringify(resume));
  } catch {
    // Resume is a convenience feature, so reading remains usable without storage.
  }
}

export function clearBrowseResume() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(browseResumeStorageKey);
  } catch {
    // There is no other local state to clear.
  }
}

export function getBrowseResumeHref(resume: BrowseResumeLocation) {
  const query = new URLSearchParams();

  if (resume.maqsadId) query.set("maqsadId", resume.maqsadId);
  if (resume.chapterId) query.set("chapterId", resume.chapterId);
  if (resume.sectionId) query.set("sectionId", resume.sectionId);
  if (resume.passageId) query.set("passageId", resume.passageId);

  const pathname = `/levels/${resume.levelId}/sciences/${resume.scienceId}/matn/${resume.matnId}`;
  const search = query.toString();

  return search ? `${pathname}?${search}` : pathname;
}
