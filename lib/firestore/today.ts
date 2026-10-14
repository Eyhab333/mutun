import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeRepetitionLevels } from "@/lib/repetition-levels";
import type {
  Chapter,
  DailyRepetition,
  Maqsad,
  Matn,
  Passage,
  Section,
  UserActivePassage,
  UserSettings,
} from "@/types";

import { firestoreCollections, type FirestoreCollectionName } from "./collections";
import {
  getActivePassageForUser,
  listActivePassagesForUser,
} from "./user-active-passages";

type VisibleContent = {
  id: string;
  isActive: boolean;
  isArchived: boolean;
};

export type TodayPassageContent = {
  activePassage: UserActivePassage;
  passage: Passage;
  matn: Matn;
  contextTitles: string[];
};

export type TodayPassageItem = TodayPassageContent & {
  repetitionCount: number;
};

export type TodayLearningQueue = {
  items: TodayPassageItem[];
  repetitionLevels: number[];
};

export type FocusPassageLoadResult =
  | { kind: "not-active" }
  | { kind: "missing-content" }
  | {
      kind: "ready";
      item: TodayPassageContent;
      repetitionLevels: number[];
    };

function documentData<T>(snapshot: { id: string; data: () => unknown }) {
  return { ...(snapshot.data() as T), id: snapshot.id } as T & { id: string };
}

function isVisibleContent(item: VisibleContent) {
  return item.isActive && !item.isArchived;
}

function chunkIds(ids: readonly string[], size = 30) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

async function getVisibleDocumentsByIds<T extends VisibleContent>(
  collectionName: FirestoreCollectionName,
  ids: readonly string[]
) {
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length === 0) {
    return new Map<string, T>();
  }

  const snapshots = await Promise.all(
    chunkIds(uniqueIds).map((chunk) =>
      getDocs(
        query(
          collection(db, collectionName),
          where(documentId(), "in", chunk)
        )
      )
    )
  );
  const items = snapshots.flatMap((snapshot) =>
    snapshot.docs.map((item) => documentData<T>(item))
  );
  const visibleItems = new Map<string, T>();

  items.filter(isVisibleContent).forEach((item) => {
    visibleItems.set(item.id, item);
  });

  return visibleItems;
}

async function resolveTodayPassageContent(
  activePassages: readonly UserActivePassage[]
) {
  const passageMap = await getVisibleDocumentsByIds<Passage>(
    firestoreCollections.passages,
    activePassages.map((item) => item.passageId)
  );
  const validPassages = activePassages.flatMap((activePassage) => {
    const passage = passageMap.get(activePassage.passageId);

    return passage && passage.matnId === activePassage.matnId
      ? [{ activePassage, passage }]
      : [];
  });
  const matnMap = await getVisibleDocumentsByIds<Matn>(
    firestoreCollections.matn,
    validPassages.map(({ passage }) => passage.matnId)
  );
  const itemsWithMatn = validPassages.flatMap(({ activePassage, passage }) => {
    const matn = matnMap.get(passage.matnId);

    return matn ? [{ activePassage, passage, matn }] : [];
  });
  const [maqasid, chapters, sections] = await Promise.all([
    getVisibleDocumentsByIds<Maqsad>(
      firestoreCollections.maqasid,
      itemsWithMatn.flatMap(({ passage }) =>
        passage.maqsadId ? [passage.maqsadId] : []
      )
    ),
    getVisibleDocumentsByIds<Chapter>(
      firestoreCollections.chapters,
      itemsWithMatn.flatMap(({ passage }) =>
        passage.chapterId ? [passage.chapterId] : []
      )
    ),
    getVisibleDocumentsByIds<Section>(
      firestoreCollections.sections,
      itemsWithMatn.flatMap(({ passage }) =>
        passage.sectionId ? [passage.sectionId] : []
      )
    ),
  ]);

  return itemsWithMatn.map(({ activePassage, passage, matn }) => ({
    activePassage,
    passage,
    matn,
    contextTitles: [
      passage.maqsadId ? maqasid.get(passage.maqsadId)?.title : undefined,
      passage.chapterId ? chapters.get(passage.chapterId)?.title : undefined,
      passage.sectionId ? sections.get(passage.sectionId)?.title : undefined,
    ].filter((title): title is string => Boolean(title)),
  }));
}

export async function listTodayRepetitionsForPassages(
  userId: string,
  dateKey: string,
  passageIds: readonly string[]
) {
  if (passageIds.length === 0) {
    return new Map<string, number>();
  }

  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.dailyRepetitions),
      where("userId", "==", userId),
      where("dateKey", "==", dateKey)
    )
  );
  const requestedIds = new Set(passageIds);
  const counts = new Map<string, number>();

  snapshot.docs
    .map((item) => documentData<DailyRepetition>(item))
    .filter((item) => requestedIds.has(item.passageId))
    .forEach((item) => {
      counts.set(item.passageId, item.repetitionCount);
    });

  return counts;
}

export async function getUserRepetitionLevels(userId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userSettings),
      where(documentId(), "==", userId),
      where("userId", "==", userId)
    )
  );
  const settingsDocument = snapshot.docs[0];

  if (!settingsDocument) {
    return normalizeRepetitionLevels(undefined);
  }

  const settings = documentData<UserSettings>(settingsDocument);

  return settings.userId === userId
    ? normalizeRepetitionLevels(settings.repetitionLevels)
    : normalizeRepetitionLevels(undefined);
}

async function buildTodayLearningQueue(
  userId: string,
  dateKey: string,
  activePassages: readonly UserActivePassage[]
): Promise<TodayLearningQueue> {
  const [contentItems, repetitionCounts, repetitionLevels] = await Promise.all([
    resolveTodayPassageContent(activePassages),
    listTodayRepetitionsForPassages(
      userId,
      dateKey,
      activePassages.map((item) => item.passageId)
    ),
    getUserRepetitionLevels(userId),
  ]);

  return {
    repetitionLevels,
    items: contentItems.map((item) => ({
      ...item,
      repetitionCount: repetitionCounts.get(item.passage.id) ?? 0,
    })),
  };
}

export async function loadTodayLearningQueue(
  userId: string,
  dateKey: string
): Promise<TodayLearningQueue> {
  const activePassages = await listActivePassagesForUser(userId);

  return buildTodayLearningQueue(userId, dateKey, activePassages);
}

export async function loadActiveFocusPassage(
  userId: string,
  passageId: string
): Promise<FocusPassageLoadResult> {
  const activePassage = await getActivePassageForUser(userId, passageId);

  if (!activePassage) {
    return { kind: "not-active" };
  }

  const [contentItems, repetitionLevels] = await Promise.all([
    resolveTodayPassageContent([activePassage]),
    getUserRepetitionLevels(userId),
  ]);
  const item = contentItems[0];

  return item
    ? { kind: "ready", item, repetitionLevels }
    : { kind: "missing-content" };
}
