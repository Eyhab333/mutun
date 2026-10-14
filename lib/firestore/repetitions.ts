import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { DailyRepetition, UserPassageStat } from "@/types";

import { firestoreCollections } from "./collections";
import {
  getDailyRepetitionDocumentId,
  getUserPassageStatsDocumentId,
} from "./deterministic-ids";
import { advanceUserMatnProgress } from "./matn-progress";
import { ensureInitialReviewSchedule } from "./reviews";

type RepetitionSyncInput = {
  userId: string;
  passageId: string;
  matnId: string;
  dateKey: string;
  targetCount: number;
  repetitionLevels: readonly number[];
};

type ExistingRecord<T> = {
  id: string;
  data: T;
  ref: ReturnType<typeof doc>;
};

function documentData<T>(snapshot: { id: string; data: () => unknown }) {
  return { ...(snapshot.data() as T), id: snapshot.id } as T & { id: string };
}

function toExistingRecord<T>(snapshot: {
  id: string;
  data: () => unknown;
  ref: ReturnType<typeof doc>;
}): ExistingRecord<T> {
  return {
    id: snapshot.id,
    data: documentData<T>(snapshot),
    ref: snapshot.ref,
  };
}

function getSingleRecord<T>(records: readonly ExistingRecord<T>[], label: string) {
  if (records.length > 1) {
    throw new Error(`Multiple ${label} records were found.`);
  }

  return records[0] ?? null;
}

function getStoredCount(value: unknown, fieldName: string) {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function getStoredPracticeDays(value: unknown) {
  return getStoredCount(value, "practiceDaysCount");
}

function validateTargetCount(targetCount: number) {
  if (!Number.isInteger(targetCount) || targetCount < 0) {
    throw new Error("The target repetition count must be a non-negative integer.");
  }
}

export type PassageRepetitionSyncResult = {
  remoteDailyCount: number;
  targetCount: number;
  delta: number;
};

async function tryAdvanceMatnProgress({
  userId,
  matnId,
  passageId,
  targetCount,
}: Pick<
  RepetitionSyncInput,
  "userId" | "matnId" | "passageId" | "targetCount"
>) {
  if (targetCount <= 0) {
    return;
  }

  try {
    await advanceUserMatnProgress(userId, matnId, passageId);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Unable to advance Matn progress after repetition sync.", error);
    }
  }
}

async function tryEnsureInitialReviewSchedule({
  userId,
  passageId,
  matnId,
  dateKey,
  previousCount,
  targetCount,
  repetitionLevels,
}: Pick<
  RepetitionSyncInput,
  "userId" | "passageId" | "matnId" | "dateKey" | "targetCount" | "repetitionLevels"
> & { previousCount: number }) {
  if (targetCount <= previousCount) {
    return;
  }

  try {
    await ensureInitialReviewSchedule({
      userId,
      passageId,
      matnId,
      practiceDateKey: dateKey,
      previousCount,
      nextCount: targetCount,
      repetitionLevels,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Unable to enroll the passage in the review cycle.", error);
    }
  }
}

export async function syncPassageRepetitionCount({
  userId,
  passageId,
  matnId,
  dateKey,
  targetCount,
  repetitionLevels,
}: RepetitionSyncInput): Promise<PassageRepetitionSyncResult> {
  validateTargetCount(targetCount);

  const [dailySnapshot, statsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, firestoreCollections.dailyRepetitions),
        where("userId", "==", userId),
        where("dateKey", "==", dateKey)
      )
    ),
    getDocs(
      query(
        collection(db, firestoreCollections.userPassageStats),
        where("userId", "==", userId),
        where("passageId", "==", passageId)
      )
    ),
  ]);
  const dailyRecord = getSingleRecord(
    dailySnapshot.docs
      .map((snapshot) => toExistingRecord<DailyRepetition>(snapshot))
      .filter((record) => record.data.passageId === passageId),
    "daily repetition"
  );
  const statsRecord = getSingleRecord(
    statsSnapshot.docs.map((snapshot) =>
      toExistingRecord<UserPassageStat>(snapshot)
    ),
    "passage statistics"
  );

  if (dailyRecord && dailyRecord.data.matnId !== matnId) {
    throw new Error("The daily repetition record does not match the passage.");
  }

  if (statsRecord && statsRecord.data.matnId !== matnId) {
    throw new Error("The passage statistics record does not match the passage.");
  }

  const remoteDailyCount = dailyRecord
    ? getStoredCount(dailyRecord.data.repetitionCount, "daily repetition count")
    : 0;
  const delta = targetCount - remoteDailyCount;
  const needsDailyWrite =
    (targetCount === 0 && Boolean(dailyRecord)) ||
    (targetCount > 0 && (!dailyRecord || targetCount !== remoteDailyCount));

  if (!needsDailyWrite && delta === 0) {
    await tryAdvanceMatnProgress({ userId, matnId, passageId, targetCount });

    return { remoteDailyCount, targetCount, delta };
  }

  const batch = writeBatch(db);

  if (targetCount === 0) {
    if (dailyRecord) {
      batch.delete(dailyRecord.ref);
    }
  } else if (dailyRecord) {
    batch.update(dailyRecord.ref, {
      repetitionCount: targetCount,
      updatedAt: serverTimestamp(),
    });
  } else {
    const id = getDailyRepetitionDocumentId(userId, passageId, dateKey);

    batch.set(doc(db, firestoreCollections.dailyRepetitions, id), {
      id,
      userId,
      passageId,
      matnId,
      dateKey,
      repetitionCount: targetCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (delta !== 0) {
    const practiceDaysDelta =
      remoteDailyCount === 0 && targetCount > 0
        ? 1
        : remoteDailyCount > 0 && targetCount === 0
          ? -1
          : 0;
    const lastRepeatedAt =
      targetCount > remoteDailyCount ? { lastRepeatedAt: serverTimestamp() } : {};

    if (statsRecord) {
      const totalRepetitions = getStoredCount(
        statsRecord.data.totalRepetitions,
        "total repetition count"
      );
      const practiceDaysCount = getStoredPracticeDays(
        statsRecord.data.practiceDaysCount
      );

      batch.update(statsRecord.ref, {
        totalRepetitions: Math.max(0, totalRepetitions + delta),
        practiceDaysCount: Math.max(0, practiceDaysCount + practiceDaysDelta),
        updatedAt: serverTimestamp(),
        ...lastRepeatedAt,
      });
    } else {
      const id = getUserPassageStatsDocumentId(userId, passageId);

      batch.set(doc(db, firestoreCollections.userPassageStats, id), {
        id,
        userId,
        passageId,
        matnId,
        totalRepetitions: Math.max(0, delta),
        practiceDaysCount: practiceDaysDelta > 0 ? 1 : 0,
        ...lastRepeatedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
  await tryAdvanceMatnProgress({ userId, matnId, passageId, targetCount });
  await tryEnsureInitialReviewSchedule({
    userId,
    passageId,
    matnId,
    dateKey,
    previousCount: remoteDailyCount,
    targetCount,
    repetitionLevels,
  });

  return { remoteDailyCount, targetCount, delta };
}
