import {
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { UserActivePassage } from "@/types";

import { firestoreCollections } from "./collections";
import { getUserActivePassageDocumentId } from "./deterministic-ids";

function documentData<T extends { id: string }>(
  snapshot: { id: string; data: () => unknown }
) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function chunkIds(ids: readonly string[], size = 30) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

export { getUserActivePassageDocumentId };

export async function listActivePassagesForUser(userId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userActivePassages),
      where("userId", "==", userId),
      where("isActive", "==", true),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<UserActivePassage>(item));
}

export async function getActivePassageForUser(
  userId: string,
  passageId: string
) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userActivePassages),
      where("userId", "==", userId),
      where("passageId", "==", passageId),
      where("isActive", "==", true)
    )
  );

  if (snapshot.docs.length > 1) {
    throw new Error("Multiple active-passage records were found.");
  }

  const activeDocument = snapshot.docs[0];

  return activeDocument
    ? documentData<UserActivePassage>(activeDocument)
    : null;
}

export async function listActivePassageIdsForUser(
  userId: string,
  passageIds?: readonly string[]
) {
  const uniquePassageIds = Array.from(new Set(passageIds ?? []));

  if (passageIds && uniquePassageIds.length === 0) {
    return new Set<string>();
  }

  const activePassages = passageIds
    ? (
        await Promise.all(
          chunkIds(uniquePassageIds).map(async (passageIdChunk) => {
            const snapshot = await getDocs(
              query(
                collection(db, firestoreCollections.userActivePassages),
                where("userId", "==", userId),
                where("passageId", "in", passageIdChunk),
                where("isActive", "==", true)
              )
            );

            return snapshot.docs.map((item) =>
              documentData<UserActivePassage>(item)
            );
          })
        )
      ).flat()
    : await listActivePassagesForUser(userId);

  return new Set(activePassages.map((item) => item.passageId));
}

function nextActiveOrder(items: readonly UserActivePassage[]) {
  return Math.max(0, ...items.map((item) => item.order)) + 1;
}

export type AddPassageToTodayResult = "added" | "readded" | "already-active";

export async function addPassageToToday(
  userId: string,
  passageId: string,
  matnId: string
): Promise<AddPassageToTodayResult> {
  const id = getUserActivePassageDocumentId(userId, passageId);
  const reference = doc(db, firestoreCollections.userActivePassages, id);

  const [existingSnapshot, activePassages] = await Promise.all([
    getDocs(
      query(
        collection(db, firestoreCollections.userActivePassages),
        where("userId", "==", userId),
        where("passageId", "==", passageId)
      )
    ),
    listActivePassagesForUser(userId),
  ]);

  const existingDoc = existingSnapshot.docs[0];

  if (existingDoc) {
    const existing = documentData<UserActivePassage>(existingDoc);

    if (existing.userId !== userId || existing.passageId !== passageId) {
      throw new Error(
        "The active-passage document does not match its identity."
      );
    }

    if (existing.isActive) {
      return "already-active";
    }

    await updateDoc(existingDoc.ref, {
      isActive: true,
      order: nextActiveOrder(activePassages),
      activatedAt: serverTimestamp(),
      deactivatedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });

    return "readded";
  }

  await setDoc(reference, {
    id,
    userId,
    passageId,
    matnId,
    isActive: true,
    order: nextActiveOrder(activePassages),
    activatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return "added";
}

export async function removePassageFromToday(userId: string, passageId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.userActivePassages),
      where("userId", "==", userId),
      where("passageId", "==", passageId),
      where("isActive", "==", true)
    )
  );

  if (snapshot.docs.length > 1) {
    throw new Error("Multiple active-passage records were found.");
  }

  const activeDocument = snapshot.docs[0];

  if (!activeDocument) {
    return;
  }

  await updateDoc(activeDocument.ref, {
    isActive: false,
    deactivatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
