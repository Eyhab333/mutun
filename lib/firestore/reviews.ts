import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  buildSuggestedReviewUnits,
  type DueReviewGroup,
} from "@/lib/review-grouping";
import {
  didCrossRepetitionThreshold,
  getEndOfLocalDay,
  getFirstReviewThreshold,
  getInitialReviewSchedule,
  getReviewDueDateTime,
} from "@/lib/review-scheduling";
import type { ReviewGroup } from "@/types";

import { firestoreCollections } from "./collections";
import { getAutomaticReviewGroupDocumentId } from "./deterministic-ids";
import {
  loadActiveMatnPassageSequence,
  type ActiveMatnPassageSequence,
} from "./matn-progress";

function documentData<T extends { id: string }>(snapshot: {
  id: string;
  data: () => unknown;
}) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function getDueDate(reviewGroup: ReviewGroup) {
  const dateValue = reviewGroup.nextReviewAt;

  return dateValue && typeof dateValue.toDate === "function"
    ? dateValue.toDate()
    : null;
}

function getUniqueGroupIds(reviewGroupIds: readonly string[]) {
  return Array.from(new Set(reviewGroupIds.filter(Boolean)));
}

function chunkPassageIds(passageIds: readonly string[], size = 30) {
  const chunks: string[][] = [];

  for (let index = 0; index < passageIds.length; index += size) {
    chunks.push(passageIds.slice(index, index + size));
  }

  return chunks;
}

export async function listHistoricalReviewPassageIdsForUser(
  userId: string,
  passageIds: readonly string[]
) {
  const requestedPassageIds = Array.from(new Set(passageIds.filter(Boolean)));

  if (requestedPassageIds.length === 0) {
    return new Set<string>();
  }

  const requestedPassageIdSet = new Set(requestedPassageIds);
  const historicalGroups = await Promise.all(
    chunkPassageIds(requestedPassageIds).map((passageIdChunk) =>
      getDocs(
        query(
          collection(db, firestoreCollections.reviewGroups),
          where("userId", "==", userId),
          where("passageIds", "array-contains-any", passageIdChunk)
        )
      )
    )
  );

  const reviewedPassageIds = new Set<string>();

  for (const snapshot of historicalGroups) {
    for (const snapshotDocument of snapshot.docs) {
      const group = documentData<ReviewGroup>(snapshotDocument);

      if (!Array.isArray(group.passageIds)) {
        continue;
      }

      for (const passageId of group.passageIds) {
        if (requestedPassageIdSet.has(passageId)) {
          reviewedPassageIds.add(passageId);
        }
      }
    }
  }

  return reviewedPassageIds;
}

export async function ensureInitialReviewSchedule({
  userId,
  passageId,
  matnId,
  practiceDateKey,
  previousCount,
  nextCount,
  repetitionLevels,
}: {
  userId: string;
  passageId: string;
  matnId: string;
  practiceDateKey: string;
  previousCount: number;
  nextCount: number;
  repetitionLevels: readonly number[] | undefined;
}) {
  const threshold = getFirstReviewThreshold(repetitionLevels);

  if (
    !didCrossRepetitionThreshold({
      previousCount,
      nextCount,
      threshold,
    })
  ) {
    return false;
  }

  const historicalGroups = await getDocs(
    query(
      collection(db, firestoreCollections.reviewGroups),
      where("userId", "==", userId),
      where("passageIds", "array-contains", passageId)
    )
  );

  if (!historicalGroups.empty) {
    return false;
  }

  const id = getAutomaticReviewGroupDocumentId(userId, passageId);
  const schedule = getInitialReviewSchedule(practiceDateKey);

  await setDoc(doc(db, firestoreCollections.reviewGroups, id), {
    id,
    userId,
    matnId,
    passageIds: [passageId],
    startPassageId: passageId,
    endPassageId: passageId,
    isActive: true,
    reviewStage: schedule.reviewStage,
    nextReviewAt: Timestamp.fromDate(getReviewDueDateTime(schedule.dueDateKey)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function listDueReviewGroups(userId: string, now = new Date()) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.reviewGroups),
      where("userId", "==", userId),
      where("isActive", "==", true),
      where("nextReviewAt", "<=", Timestamp.fromDate(getEndOfLocalDay(now))),
      orderBy("nextReviewAt", "asc")
    )
  );

  const invalidReviewGroupIds: string[] = [];
  const dueGroups: DueReviewGroup[] = [];

  for (const snapshotDocument of snapshot.docs) {
    const group = documentData<ReviewGroup>(snapshotDocument);
    const dueAt = getDueDate(group);

    if (!dueAt || Number.isNaN(dueAt.getTime())) {
      invalidReviewGroupIds.push(group.id);
      continue;
    }

    dueGroups.push({ group, dueAt });
  }

  return { dueGroups, invalidReviewGroupIds };
}

export async function loadDueReviewSuggestions(userId: string, now = new Date()) {
  const dueResult = await listDueReviewGroups(userId, now);
  const matnIds = Array.from(
    new Set(dueResult.dueGroups.map(({ group }) => group.matnId))
  );
  const sequenceEntries = await Promise.all(
    matnIds.map(async (matnId) => [
      matnId,
      await loadActiveMatnPassageSequence(matnId),
    ] as const)
  );
  const sequences = new Map<string, ActiveMatnPassageSequence>(
    sequenceEntries.flatMap(([matnId, sequence]) =>
      sequence ? [[matnId, sequence] as const] : []
    )
  );
  const suggestions = buildSuggestedReviewUnits(dueResult.dueGroups, sequences);

  return {
    units: suggestions.units,
    invalidReviewGroupIds: [
      ...dueResult.invalidReviewGroupIds,
      ...suggestions.invalidReviewGroupIds,
    ],
  };
}

export async function deferReviewGroups(
  reviewGroupIds: readonly string[],
  dueDateKey: string
) {
  const groupIds = getUniqueGroupIds(reviewGroupIds);

  if (groupIds.length === 0) {
    return;
  }

  const batch = writeBatch(db);
  const nextReviewAt = Timestamp.fromDate(getReviewDueDateTime(dueDateKey));

  for (const groupId of groupIds) {
    batch.update(doc(db, firestoreCollections.reviewGroups, groupId), {
      nextReviewAt,
      lastDeferredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function ignoreReviewGroups(reviewGroupIds: readonly string[]) {
  const groupIds = getUniqueGroupIds(reviewGroupIds);

  if (groupIds.length === 0) {
    return;
  }

  const batch = writeBatch(db);

  for (const groupId of groupIds) {
    batch.update(doc(db, firestoreCollections.reviewGroups, groupId), {
      isActive: false,
      ignoredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}
