import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { DocumentReference } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  buildMatnPassageSequence,
  getPassagePosition,
  isPassageFarther,
} from "@/lib/matn-passage-sequence";
import type {
  Chapter,
  Maqsad,
  Matn,
  Passage,
  Section,
  UserMatnProgress,
} from "@/types";

import { firestoreCollections } from "./collections";
import { getUserMatnProgressDocumentId } from "./deterministic-ids";

type ProgressRecord = {
  data: UserMatnProgress;
  ref: DocumentReference;
};

export type ActiveMatnPassageSequence = {
  matn: Matn;
  passages: Passage[];
};

export type MatnProgressSummary = {
  farthestPassageId: string | null;
  currentPosition: number | null;
  totalPassages: number;
};

function documentData<T extends { id: string }>(snapshot: {
  id: string;
  data: () => unknown;
}) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function isVisibleMatn(matn: Matn) {
  return matn.isActive && !matn.isArchived;
}

function getSingleProgressRecord(records: readonly ProgressRecord[]) {
  if (records.length > 1) {
    throw new Error("Multiple Matn progress records were found.");
  }

  return records[0] ?? null;
}

async function findUserMatnProgress(userId: string, matnId: string) {
  // Querying keeps the private-document read compatible with ownership rules
  // when the deterministic document has not been created yet.
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userMatnProgress),
      where("userId", "==", userId),
      where("matnId", "==", matnId)
    )
  );

  return getSingleProgressRecord(
    snapshot.docs.map((item) => ({
      data: documentData<UserMatnProgress>(item),
      ref: item.ref,
    }))
  );
}

export async function loadActiveMatnPassageSequence(
  matnId: string
): Promise<ActiveMatnPassageSequence | null> {
  const [matnSnapshot, maqasidSnapshot, chaptersSnapshot, sectionsSnapshot, passagesSnapshot] =
    await Promise.all([
      getDoc(doc(db, firestoreCollections.matn, matnId)),
      getDocs(
        query(
          collection(db, firestoreCollections.maqasid),
          where("matnId", "==", matnId),
          orderBy("order", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, firestoreCollections.chapters),
          where("matnId", "==", matnId),
          orderBy("order", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, firestoreCollections.sections),
          where("matnId", "==", matnId),
          orderBy("order", "asc")
        )
      ),
      getDocs(
        query(
          collection(db, firestoreCollections.passages),
          where("matnId", "==", matnId),
          orderBy("order", "asc")
        )
      ),
    ]);

  if (!matnSnapshot.exists()) {
    return null;
  }

  const matn = documentData<Matn>(matnSnapshot);

  if (!isVisibleMatn(matn)) {
    return null;
  }

  return {
    matn,
    passages: buildMatnPassageSequence({
      matn,
      maqasid: maqasidSnapshot.docs.map((item) => documentData<Maqsad>(item)),
      chapters: chaptersSnapshot.docs.map((item) => documentData<Chapter>(item)),
      sections: sectionsSnapshot.docs.map((item) => documentData<Section>(item)),
      passages: passagesSnapshot.docs.map((item) => documentData<Passage>(item)),
    }),
  };
}

export async function getUserMatnProgress(userId: string, matnId: string) {
  return (await findUserMatnProgress(userId, matnId))?.data ?? null;
}

export async function getMatnProgressSummary(
  userId: string,
  matnId: string
): Promise<MatnProgressSummary | null> {
  const [sequence, progress] = await Promise.all([
    loadActiveMatnPassageSequence(matnId),
    findUserMatnProgress(userId, matnId),
  ]);

  if (!sequence) {
    return null;
  }

  const farthestPassageId = progress?.data.farthestPassageId ?? null;

  return {
    farthestPassageId,
    currentPosition: farthestPassageId
      ? getPassagePosition(sequence.passages, farthestPassageId)
      : null,
    totalPassages: sequence.passages.length,
  };
}

export async function advanceUserMatnProgress(
  userId: string,
  matnId: string,
  candidatePassageId: string
) {
  const [sequence, existingProgress] = await Promise.all([
    loadActiveMatnPassageSequence(matnId),
    findUserMatnProgress(userId, matnId),
  ]);

  if (
    !sequence ||
    !isPassageFarther(
      sequence.passages,
      existingProgress?.data.farthestPassageId ?? null,
      candidatePassageId
    )
  ) {
    return false;
  }

  if (existingProgress) {
    await updateDoc(existingProgress.ref, {
      farthestPassageId: candidatePassageId,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  const id = getUserMatnProgressDocumentId(userId, matnId);

  await setDoc(doc(db, firestoreCollections.userMatnProgress, id), {
    id,
    userId,
    matnId,
    farthestPassageId: candidatePassageId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}
