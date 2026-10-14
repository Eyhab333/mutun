import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import type { DocumentReference } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  getEndOfLocalDay,
  getFirstReviewThreshold,
  getNextReviewSchedule,
  getReviewDueDateTime,
} from "@/lib/review-scheduling";
import type { ReviewFocusRouteRequest } from "@/lib/review-focus-route";
import type { Passage, ReviewGroup } from "@/types";

import { firestoreCollections } from "./collections";
import {
  loadActiveMatnPassageSequence,
  type ActiveMatnPassageSequence,
} from "./matn-progress";
import { getUserRepetitionLevels } from "./today";

const MAX_IN_QUERY_SIZE = 30;

type ReviewGroupRecord = {
  data: ReviewGroup;
  ref: DocumentReference;
};

type ReviewGroupSpan = {
  record: ReviewGroupRecord;
  startPosition: number;
  endPosition: number;
};

type ValidatedReviewFocus = {
  sequence: ActiveMatnPassageSequence;
  sourceGroups: ReviewGroupRecord[];
  passages: Passage[];
};

export type ReviewFocusSession = {
  matn: ActiveMatnPassageSequence["matn"];
  reviewStage: ReviewFocusRouteRequest["reviewStage"];
  passages: { passage: Passage; position: number }[];
  repetitionLevels: number[];
};

export class ReviewFocusValidationError extends Error {
  constructor(message = "The requested review focus session is no longer valid.") {
    super(message);
    this.name = "ReviewFocusValidationError";
  }
}

function documentData<T extends { id: string }>(snapshot: {
  id: string;
  data: () => unknown;
}) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function chunkIds(ids: readonly string[]) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += MAX_IN_QUERY_SIZE) {
    chunks.push(ids.slice(index, index + MAX_IN_QUERY_SIZE));
  }

  return chunks;
}

function getUniqueIds(ids: readonly string[]) {
  const normalized = ids.map((id) => id.trim());

  if (normalized.some((id) => !id) || new Set(normalized).size !== normalized.length) {
    throw new ReviewFocusValidationError();
  }

  return normalized;
}

function hasSameIds(first: readonly string[], second: readonly string[]) {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

function getDueDate(group: ReviewGroup) {
  const value = group.nextReviewAt as unknown as { toDate?: () => Date };
  const date = typeof value?.toDate === "function" ? value.toDate() : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getPassagePositionMap(sequence: readonly Passage[]) {
  return new Map(sequence.map((passage, index) => [passage.id, index + 1]));
}

function validateGroupSpan(
  record: ReviewGroupRecord,
  positionByPassageId: ReadonlyMap<string, number>
): ReviewGroupSpan {
  const group = record.data;
  const passageIds = getUniqueIds(group.passageIds);
  const startPosition = positionByPassageId.get(group.startPassageId);
  const endPosition = positionByPassageId.get(group.endPassageId);

  if (
    startPosition === undefined ||
    endPosition === undefined ||
    startPosition > endPosition
  ) {
    throw new ReviewFocusValidationError();
  }

  const orderedPositions = passageIds
    .map((passageId) => positionByPassageId.get(passageId))
    .sort((first, second) => (first ?? Infinity) - (second ?? Infinity));

  if (
    orderedPositions.some((position) => position === undefined) ||
    orderedPositions.length !== endPosition - startPosition + 1 ||
    !orderedPositions.every((position, index) => position === startPosition + index)
  ) {
    throw new ReviewFocusValidationError();
  }

  return { record, startPosition, endPosition };
}

async function findReviewGroupsForUser(
  userId: string,
  reviewGroupIds: readonly string[]
) {
  const groupIds = getUniqueIds(reviewGroupIds);
  const snapshots = await Promise.all(
    chunkIds(groupIds).map((ids) =>
      getDocs(
        query(
          collection(db, firestoreCollections.reviewGroups),
          where("userId", "==", userId),
          where(documentId(), "in", ids)
        )
      )
    )
  );
  const records = snapshots.flatMap((snapshot) =>
    snapshot.docs.map((item) => ({
      data: documentData<ReviewGroup>(item),
      ref: item.ref,
    }))
  );

  if (records.length !== groupIds.length) {
    throw new ReviewFocusValidationError();
  }

  const recordById = new Map(records.map((record) => [record.data.id, record]));
  const orderedRecords = groupIds.map((id) => recordById.get(id));

  if (orderedRecords.some((record) => !record)) {
    throw new ReviewFocusValidationError();
  }

  return orderedRecords as ReviewGroupRecord[];
}

async function validateReviewFocus(
  userId: string,
  request: ReviewFocusRouteRequest,
  now: Date
): Promise<ValidatedReviewFocus> {
  const [sourceGroups, sequence] = await Promise.all([
    findReviewGroupsForUser(userId, request.sourceReviewGroupIds),
    loadActiveMatnPassageSequence(request.matnId),
  ]);

  if (!sequence) {
    throw new ReviewFocusValidationError();
  }

  const endOfToday = getEndOfLocalDay(now);

  if (
    sourceGroups.some((record, index) => {
      const group = record.data;
      const dueAt = getDueDate(group);

      return (
        group.userId !== userId ||
        group.matnId !== request.matnId ||
        group.reviewStage !== request.reviewStage ||
        !group.isActive ||
        !dueAt ||
        dueAt.toISOString() !== request.sourceReviewGroupDueAts[index] ||
        dueAt > endOfToday
      );
    })
  ) {
    throw new ReviewFocusValidationError();
  }

  const positionByPassageId = getPassagePositionMap(sequence.passages);
  const spans = sourceGroups
    .map((record) => validateGroupSpan(record, positionByPassageId))
    .sort((first, second) => first.startPosition - second.startPosition);
  const firstSpan = spans[0];
  const lastSpan = spans.at(-1);

  if (!firstSpan || !lastSpan) {
    throw new ReviewFocusValidationError();
  }

  if (
    !spans.every(
      (span, index) => index === 0 || span.startPosition === spans[index - 1].endPosition + 1
    )
  ) {
    throw new ReviewFocusValidationError();
  }

  const passages = sequence.passages.slice(
    firstSpan.startPosition - 1,
    lastSpan.endPosition
  );
  const requestedPassageIds = getUniqueIds(request.passageIds);

  if (!hasSameIds(requestedPassageIds, passages.map((passage) => passage.id))) {
    throw new ReviewFocusValidationError();
  }

  return { sequence, sourceGroups, passages };
}

export async function loadReviewFocusSession(
  userId: string,
  request: ReviewFocusRouteRequest
): Promise<ReviewFocusSession> {
  const [validated, repetitionLevels] = await Promise.all([
    validateReviewFocus(userId, request, new Date()),
    getUserRepetitionLevels(userId),
  ]);

  return {
    matn: validated.sequence.matn,
    reviewStage: request.reviewStage,
    passages: validated.passages.map((passage) => ({
      passage,
      position: validated.sequence.passages.findIndex((item) => item.id === passage.id) + 1,
    })),
    repetitionLevels,
  };
}

export async function completeReviewFocus({
  userId,
  request,
  repetitionCount,
  completedDateKey,
}: {
  userId: string;
  request: ReviewFocusRouteRequest;
  repetitionCount: number;
  completedDateKey: string;
}) {
  const safeRepetitionCount = Math.floor(repetitionCount);

  if (
    !Number.isSafeInteger(safeRepetitionCount) ||
    safeRepetitionCount < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(completedDateKey)
  ) {
    throw new ReviewFocusValidationError();
  }

  const [validated, repetitionLevels] = await Promise.all([
    validateReviewFocus(userId, request, new Date()),
    getUserRepetitionLevels(userId),
  ]);
  const threshold = getFirstReviewThreshold(repetitionLevels);

  if (safeRepetitionCount < threshold) {
    throw new ReviewFocusValidationError();
  }

  const nextSchedule = getNextReviewSchedule({
    completedStage: request.reviewStage,
    completedDateKey,
  });
  const recordReference = doc(collection(db, firestoreCollections.reviewRecords));
  const batch = writeBatch(db);

  batch.set(recordReference, {
    id: recordReference.id,
    userId,
    reviewGroupIds: validated.sourceGroups.map((record) => record.data.id),
    matnId: request.matnId,
    passageIds: validated.passages.map((passage) => passage.id),
    startPassageId: validated.passages[0].id,
    endPassageId: validated.passages.at(-1)?.id ?? validated.passages[0].id,
    dateKey: completedDateKey,
    repetitionCount: safeRepetitionCount,
    reviewStage: request.reviewStage,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const nextReviewAt = Timestamp.fromDate(
    getReviewDueDateTime(nextSchedule.dueDateKey)
  );

  for (const sourceGroup of validated.sourceGroups) {
    batch.update(sourceGroup.ref, {
      isActive: true,
      reviewStage: nextSchedule.reviewStage,
      nextReviewAt,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  return { recordId: recordReference.id, nextSchedule };
}
