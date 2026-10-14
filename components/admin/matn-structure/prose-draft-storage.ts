import type { PassageParent } from "@/lib/firestore/matn-structure";

export type DraftPassage = {
  tempId: string;
  text: string;
};

export type PassageImportMode = "PROSE" | "POETRY";

export type PassageImportDraft = {
  version: 1;
  mode: PassageImportMode;
  matnId: string;
  context: Pick<PassageParent, "maqsadId" | "chapterId" | "sectionId">;
  sourceText: string;
  draftPassages: DraftPassage[];
  updatedAt: string;
};

export type ProseDraft = PassageImportDraft;

type StoredPassageImportDraft = Omit<PassageImportDraft, "mode"> & {
  mode?: PassageImportMode;
};

export function createPassageDraftStorageKey(
  mode: PassageImportMode,
  parent: PassageParent
) {
  const contextKey = parent.sectionId
    ? `section:${parent.sectionId}`
    : parent.chapterId
      ? `chapter:${parent.chapterId}`
      : parent.maqsadId
        ? `maqsad:${parent.maqsadId}`
        : `matn:${parent.matnId}`;

  return `mutun:${mode === "PROSE" ? "prose" : "poetry"}-draft:${parent.matnId}:${contextKey}`;
}

export function createProseDraftStorageKey(parent: PassageParent) {
  return createPassageDraftStorageKey("PROSE", parent);
}

export function createDraftPassage(text: string): DraftPassage {
  const tempId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return { tempId, text };
}

function matchesContext(context: unknown, parent: PassageParent) {
  if (!context || typeof context !== "object") {
    return false;
  }

  const draftContext = context as PassageImportDraft["context"];

  return (
    draftContext.maqsadId === parent.maqsadId &&
    draftContext.chapterId === parent.chapterId &&
    draftContext.sectionId === parent.sectionId
  );
}

function isValidDraft(
  value: unknown,
  parent: PassageParent,
  mode: PassageImportMode
): value is StoredPassageImportDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Partial<StoredPassageImportDraft>;

  return (
    draft.version === 1 &&
    // Earlier prose drafts did not carry a mode. Keep those local drafts
    // recoverable, while every new poetry draft is explicitly namespaced.
    (draft.mode === mode || (mode === "PROSE" && draft.mode === undefined)) &&
    draft.matnId === parent.matnId &&
    typeof draft.sourceText === "string" &&
    typeof draft.updatedAt === "string" &&
    Array.isArray(draft.draftPassages) &&
    draft.draftPassages.length > 0 &&
    draft.draftPassages.every(
      (passage) =>
        Boolean(passage) &&
        typeof passage.tempId === "string" &&
        typeof passage.text === "string"
    ) &&
    matchesContext(draft.context, parent)
  );
}

export function readProseDraft(
  storageKey: string,
  parent: PassageParent
): ProseDraft | null {
  return readPassageDraft(storageKey, parent, "PROSE");
}

export function readPassageDraft(
  storageKey: string,
  parent: PassageParent,
  mode: PassageImportMode
): PassageImportDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (isValidDraft(parsed, parent, mode)) {
      return { ...parsed, mode };
    }

    window.localStorage.removeItem(storageKey);
  } catch {
    // A malformed or inaccessible local draft must never prevent passage work.
  }

  return null;
}

export function saveProseDraft(
  storageKey: string,
  parent: PassageParent,
  sourceText: string,
  draftPassages: readonly DraftPassage[]
) {
  savePassageDraft(storageKey, parent, "PROSE", sourceText, draftPassages);
}

export function savePassageDraft(
  storageKey: string,
  parent: PassageParent,
  mode: PassageImportMode,
  sourceText: string,
  draftPassages: readonly DraftPassage[]
) {
  const draft: PassageImportDraft = {
    version: 1,
    mode,
    matnId: parent.matnId,
    context: {
      ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}),
      ...(parent.chapterId ? { chapterId: parent.chapterId } : {}),
      ...(parent.sectionId ? { sectionId: parent.sectionId } : {}),
    },
    sourceText,
    draftPassages: draftPassages.map((passage) => ({ ...passage })),
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Browser storage is a convenience recovery layer; the editor stays usable
    // if it is unavailable or full.
  }
}

export function removePassageDraft(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing else should be cleared when this exact local draft cannot be removed.
  }
}

export function removeProseDraft(storageKey: string) {
  removePassageDraft(storageKey);
}
