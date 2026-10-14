import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  buildSuggestedRepairUnits,
  type SuggestedRepairUnit,
} from "@/lib/repair-grouping";
import type { Passage, RepairRecord } from "@/types";

import { firestoreCollections } from "./collections";
import {
  loadActiveMatnPassageSequence,
  type ActiveMatnPassageSequence,
} from "./matn-progress";
import { getUserRepetitionLevels } from "./today";
import { listWeakPassageStates } from "./user-passage-states";
import { getFirstReviewThreshold } from "@/lib/review-scheduling";
import type { RepairFocusRouteRequest } from "@/lib/repair-focus-route";

export type RepairFocusSession = {
  matn: ActiveMatnPassageSequence["matn"];
  passages: { passage: Passage; position: number }[];
  repetitionLevels: number[];
};

export class RepairFocusValidationError extends Error {
  constructor(message = "The requested repair session is no longer valid.") {
    super(message);
    this.name = "RepairFocusValidationError";
  }
}

function getUniqueIds(ids: readonly string[]) {
  const normalized = ids.map((id) => id.trim());

  if (normalized.some((id) => !id) || new Set(normalized).size !== normalized.length) {
    throw new RepairFocusValidationError();
  }

  return normalized;
}

function getPassagesForRepairFocus(
  sequence: ActiveMatnPassageSequence,
  passageIds: readonly string[],
  weakPassageIds: ReadonlySet<string>
) {
  const positionsById = new Map(
    sequence.passages.map((passage, index) => [passage.id, index + 1])
  );
  const uniqueIds = getUniqueIds(passageIds);
  const positions = uniqueIds.map((id) => positionsById.get(id));

  if (
    positions.some((position) => position === undefined) ||
    !uniqueIds.every((id) => weakPassageIds.has(id))
  ) {
    throw new RepairFocusValidationError();
  }

  const validPositions = positions as number[];

  if (
    !validPositions.every(
      (position, index) => index === 0 || position === validPositions[index - 1] + 1
    )
  ) {
    throw new RepairFocusValidationError();
  }

  return uniqueIds.map((id, index) => {
    const passage = sequence.passages.find((item) => item.id === id);
    const position = validPositions[index];

    if (!passage || position === undefined) {
      throw new RepairFocusValidationError();
    }

    return { passage, position };
  });
}

async function validateRepairFocus(
  userId: string,
  request: RepairFocusRouteRequest
) {
  const [sequence, weakStates, repetitionLevels] = await Promise.all([
    loadActiveMatnPassageSequence(request.matnId),
    listWeakPassageStates(userId),
    getUserRepetitionLevels(userId),
  ]);

  if (!sequence) {
    throw new RepairFocusValidationError();
  }

  const weakPassageIds = new Set(
    weakStates
      .filter((state) => state.matnId === request.matnId)
      .map((state) => state.passageId)
  );
  const passages = getPassagesForRepairFocus(
    sequence,
    request.passageIds,
    weakPassageIds
  );

  return { sequence, passages, repetitionLevels };
}

export async function loadRepairSuggestions(userId: string) {
  const weakStates = await listWeakPassageStates(userId);
  const weakPassageIdsByMatn = new Map<string, Set<string>>();

  weakStates.forEach((state) => {
    const ids = weakPassageIdsByMatn.get(state.matnId) ?? new Set<string>();
    ids.add(state.passageId);
    weakPassageIdsByMatn.set(state.matnId, ids);
  });

  const groupedUnits = await Promise.all(
    [...weakPassageIdsByMatn.entries()].map(async ([matnId, weakPassageIds]) => {
      const sequence = await loadActiveMatnPassageSequence(matnId);

      return sequence
        ? buildSuggestedRepairUnits({
            matn: sequence.matn,
            sequence: sequence.passages,
            weakPassageIds,
          })
        : [];
    })
  );

  return groupedUnits
    .flat()
    .sort((first, second) => first.matn.name.localeCompare(second.matn.name, "ar"));
}

export async function loadRepairFocusSession(
  userId: string,
  request: RepairFocusRouteRequest
): Promise<RepairFocusSession> {
  const { sequence, passages, repetitionLevels } = await validateRepairFocus(
    userId,
    request
  );

  return {
    matn: sequence.matn,
    passages,
    repetitionLevels,
  };
}

export async function createRepairRecord({
  userId,
  request,
  repetitionCount,
  dateKey,
}: {
  userId: string;
  request: RepairFocusRouteRequest;
  repetitionCount: number;
  dateKey: string;
}) {
  const safeRepetitionCount = repetitionCount;

  if (
    !Number.isSafeInteger(safeRepetitionCount) ||
    safeRepetitionCount < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
  ) {
    throw new RepairFocusValidationError();
  }

  const session = await loadRepairFocusSession(userId, request);

  if (safeRepetitionCount < getFirstReviewThreshold(session.repetitionLevels)) {
    throw new RepairFocusValidationError();
  }

  const reference = doc(collection(db, firestoreCollections.repairRecords));
  const record: Omit<RepairRecord, "createdAt" | "updatedAt"> = {
    id: reference.id,
    userId,
    matnId: session.matn.id,
    passageIds: session.passages.map(({ passage }) => passage.id),
    dateKey,
    repetitionCount: safeRepetitionCount,
  };

  await setDoc(reference, {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export type { SuggestedRepairUnit };
