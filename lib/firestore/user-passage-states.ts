import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { DocumentReference } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { UserPassageState } from "@/types";

import { firestoreCollections } from "./collections";
import { getUserPassageStateDocumentId } from "./deterministic-ids";

type PassageStateRecord = {
  data: UserPassageState;
  ref: DocumentReference;
};

function documentData<T extends { id: string }>(snapshot: {
  id: string;
  data: () => unknown;
}) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function getSinglePassageState(records: readonly PassageStateRecord[]) {
  if (records.length > 1) {
    throw new Error("Multiple passage-state records were found.");
  }

  return records[0] ?? null;
}

async function findUserPassageState(userId: string, passageId: string) {
  // A scoped query remains permitted when this user's deterministic document
  // has not been created yet; a direct read would not be safe for discovery.
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userPassageStates),
      where("userId", "==", userId),
      where("passageId", "==", passageId)
    )
  );

  return getSinglePassageState(
    snapshot.docs.map((item) => ({
      data: documentData<UserPassageState>(item),
      ref: item.ref,
    }))
  );
}

export { getUserPassageStateDocumentId };

export async function getUserPassageWeakState(userId: string, passageId: string) {
  return (await findUserPassageState(userId, passageId))?.data ?? null;
}

export async function listWeakPassageStates(userId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userPassageStates),
      where("userId", "==", userId),
      where("isWeak", "==", true)
    )
  );

  return snapshot.docs.map((item) => documentData<UserPassageState>(item));
}

export async function setPassageWeak({
  userId,
  passageId,
  matnId,
  isWeak,
}: {
  userId: string;
  passageId: string;
  matnId: string;
  isWeak: boolean;
}) {
  const existing = await findUserPassageState(userId, passageId);

  if (existing) {
    if (
      existing.data.userId !== userId ||
      existing.data.passageId !== passageId ||
      existing.data.matnId !== matnId
    ) {
      throw new Error("The passage-state record does not match its identity.");
    }

    if (existing.data.isWeak === isWeak) {
      return isWeak;
    }

    await updateDoc(existing.ref, {
      isWeak,
      ...(isWeak
        ? { weakMarkedAt: serverTimestamp() }
        : { weakClearedAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    });

    return isWeak;
  }

  const id = getUserPassageStateDocumentId(userId, passageId);

  await setDoc(doc(db, firestoreCollections.userPassageStates, id), {
    id,
    userId,
    passageId,
    matnId,
    isWeak,
    ...(isWeak
      ? { weakMarkedAt: serverTimestamp() }
      : { weakClearedAt: serverTimestamp() }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return isWeak;
}
