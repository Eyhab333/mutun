import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { BookReadingCycle, BookReadingDailyStat } from "@/types";

import { getFirestoreCollectionPath } from "./collections";
import {
  getBookReadingCycleDocumentId,
  getBookReadingDailyStatDocumentId,
} from "./deterministic-ids";

type ExistingRecord<T> = {
  id: string;
  data: T;
  ref: ReturnType<typeof doc>;
};

export type BookReadingSummary = {
  cycles: BookReadingCycle[];
  currentCycle: BookReadingCycle | null;
  completedCyclesCount: number;
  pagesReadToday: number;
};

export type AdvanceBookReadingInput = {
  userId: string;
  bookId: string;
  cycleId: string;
  pageCount: number;
  expectedCurrentPage: number;
  action: "previous" | "next" | "jump" | "complete";
  targetPage?: number;
  dateKey: string;
};

export type AdvanceBookReadingResult = {
  currentPage: number;
  readThroughPage: number;
  status: BookReadingCycle["status"];
  didAdvanceProgress: boolean;
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

function validatePageCount(pageCount: number) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("This book does not have readable pages yet.");
  }
}

function validatePage(page: number, pageCount: number) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw new Error("Invalid book page.");
  }
}

function getCycleReference(cycleId: string) {
  return doc(
    db,
    getFirestoreCollectionPath("bookReadingCycles"),
    cycleId
  );
}

async function findDailyStat(
  userId: string,
  cycleId: string,
  dateKey: string
) {
  // Query first: direct reads of a missing private deterministic document are
  // intentionally incompatible with the project's ownership rules.
  const snapshot = await getDocs(
    query(
      collection(db, getFirestoreCollectionPath("bookReadingDailyStats")),
      where("userId", "==", userId),
      where("cycleId", "==", cycleId),
      where("dateKey", "==", dateKey)
    )
  );

  return getSingleRecord(
    snapshot.docs.map((item) => toExistingRecord<BookReadingDailyStat>(item)),
    "book reading daily statistic"
  );
}

export async function listBookReadingCycles(userId: string, bookId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, getFirestoreCollectionPath("bookReadingCycles")),
      where("userId", "==", userId),
      where("bookId", "==", bookId),
      orderBy("cycleNumber", "desc")
    )
  );

  return snapshot.docs.map((item) => documentData<BookReadingCycle>(item));
}

export async function getInProgressBookReadingCycle(userId: string, bookId: string) {
  const cycles = await listBookReadingCycles(userId, bookId);
  const inProgress = cycles.filter((cycle) => cycle.status === "IN_PROGRESS");

  if (inProgress.length > 1) {
    throw new Error("Multiple active book reading cycles were found.");
  }

  return inProgress[0] ?? null;
}

export async function listBookReadingDailyStatsForDate(userId: string, dateKey: string) {
  const snapshot = await getDocs(
    query(
      collection(db, getFirestoreCollectionPath("bookReadingDailyStats")),
      where("userId", "==", userId),
      where("dateKey", "==", dateKey)
    )
  );

  return snapshot.docs.map((item) => documentData<BookReadingDailyStat>(item));
}

export async function getBookReadingSummary(
  userId: string,
  bookId: string,
  dateKey: string
): Promise<BookReadingSummary> {
  const [cycles, dailyStats] = await Promise.all([
    listBookReadingCycles(userId, bookId),
    listBookReadingDailyStatsForDate(userId, dateKey),
  ]);
  const currentCycles = cycles.filter((cycle) => cycle.status === "IN_PROGRESS");

  if (currentCycles.length > 1) {
    throw new Error("Multiple active book reading cycles were found.");
  }

  return {
    cycles,
    currentCycle: currentCycles[0] ?? null,
    completedCyclesCount: cycles.filter((cycle) => cycle.status === "COMPLETED")
      .length,
    pagesReadToday: dailyStats
      .filter((stat) => stat.bookId === bookId)
      .reduce((total, stat) => total + stat.pagesRead, 0),
  };
}

export async function startBookReadingCycle(
  userId: string,
  bookId: string,
  pageCount: number
) {
  validatePageCount(pageCount);
  const cycles = await listBookReadingCycles(userId, bookId);
  const inProgress = cycles.filter((cycle) => cycle.status === "IN_PROGRESS");

  if (inProgress.length > 1) {
    throw new Error("Multiple active book reading cycles were found.");
  }

  if (inProgress[0]) {
    return inProgress[0];
  }

  const cycleNumber = Math.max(0, ...cycles.map((cycle) => cycle.cycleNumber)) + 1;
  const id = getBookReadingCycleDocumentId(userId, bookId, cycleNumber);
  const reference = getCycleReference(id);

  await setDoc(reference, {
    id,
    userId,
    bookId,
    cycleNumber,
    status: "IN_PROGRESS",
    currentPage: 1,
    readThroughPage: 0,
    startedAt: serverTimestamp(),
    lastReadAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id,
    userId,
    bookId,
    cycleNumber,
    status: "IN_PROGRESS" as const,
    currentPage: 1,
    readThroughPage: 0,
  };
}

export async function advanceBookReadingCycle({
  userId,
  bookId,
  cycleId,
  pageCount,
  expectedCurrentPage,
  action,
  targetPage,
  dateKey,
}: AdvanceBookReadingInput): Promise<AdvanceBookReadingResult> {
  validatePageCount(pageCount);
  validatePage(expectedCurrentPage, pageCount);

  const cycles = await listBookReadingCycles(userId, bookId);
  const cycle = cycles.find((item) => item.id === cycleId) ?? null;

  if (!cycle || cycle.status !== "IN_PROGRESS") {
    throw new Error("The reading cycle is no longer active.");
  }

  const existingDailyStat = await findDailyStat(userId, cycleId, dateKey);
  const cycleReference = getCycleReference(cycleId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cycleReference);

    if (!snapshot.exists()) {
      throw new Error("The reading cycle no longer exists.");
    }

    const currentCycle = documentData<BookReadingCycle>(snapshot);

    if (
      currentCycle.userId !== userId ||
      currentCycle.bookId !== bookId ||
      currentCycle.status !== "IN_PROGRESS"
    ) {
      throw new Error("The reading cycle changed before progress could be saved.");
    }

    validatePage(currentCycle.currentPage, pageCount);

    if (currentCycle.currentPage !== expectedCurrentPage) {
      throw new Error("The reading position changed in another tab. Refresh and try again.");
    }

    let currentPage = currentCycle.currentPage;
    let readThroughPage = currentCycle.readThroughPage;
    let status: BookReadingCycle["status"] = currentCycle.status;
    let progressedPage: number | null = null;
    let completed = false;

    if (action === "previous") {
      currentPage = Math.max(1, currentCycle.currentPage - 1);
    }

    if (action === "jump") {
      if (targetPage === undefined) {
        throw new Error("A target page is required.");
      }

      validatePage(targetPage, pageCount);
      currentPage = targetPage;
    }

    if (action === "next") {
      if (currentCycle.currentPage >= pageCount) {
        throw new Error("The final page must be completed explicitly.");
      }

      if (currentCycle.currentPage === currentCycle.readThroughPage + 1) {
        progressedPage = currentCycle.currentPage;
        readThroughPage = progressedPage;
      }

      currentPage = currentCycle.currentPage + 1;
    }

    if (action === "complete") {
      if (
        currentCycle.currentPage !== pageCount ||
        currentCycle.readThroughPage !== pageCount - 1
      ) {
        throw new Error("The preceding pages have not been read consecutively.");
      }

      progressedPage = pageCount;
      readThroughPage = pageCount;
      status = "COMPLETED";
      completed = true;
    }

    transaction.update(cycleReference, {
      currentPage,
      readThroughPage,
      status,
      lastReadAt: serverTimestamp(),
      ...(completed ? { completedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });

    if (progressedPage !== null) {
      const statId = getBookReadingDailyStatDocumentId(userId, cycleId, dateKey);
      const statReference = existingDailyStat?.ref ?? doc(
        db,
        getFirestoreCollectionPath("bookReadingDailyStats"),
        statId
      );

      transaction.set(
        statReference,
        {
          ...(existingDailyStat
            ? {}
            : {
                id: statId,
                userId,
                bookId,
                cycleId,
                dateKey,
                createdAt: serverTimestamp(),
                firstPage: progressedPage,
              }),
          pagesRead: increment(1),
          lastPage: progressedPage,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      currentPage,
      readThroughPage,
      status,
      didAdvanceProgress: progressedPage !== null,
    } satisfies AdvanceBookReadingResult;
  });
}
