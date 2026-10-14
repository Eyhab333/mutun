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
import type { Level, Matn, Science } from "@/types";

import { firestoreCollections } from "./collections";

export type LevelInput = Pick<Level, "name" | "order" | "isActive">;

export type ScienceInput = Pick<Science, "name" | "order" | "isActive">;

export type MatnInput = Pick<
  Matn,
  | "name"
  | "description"
  | "type"
  | "hasMaqasid"
  | "hasChapters"
  | "hasSections"
  | "order"
  | "isActive"
>;

function documentData<T extends { id: string }>(
  snapshot: { id: string; data: () => unknown }
) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

export async function listLevels() {
  const snapshot = await getDocs(
    query(collection(db, firestoreCollections.levels), orderBy("order", "asc"))
  );

  return snapshot.docs.map((item) => documentData<Level>(item));
}

export async function createLevel({
  name,
  order,
  isActive,
}: LevelInput) {
  const reference = doc(collection(db, firestoreCollections.levels));

  await setDoc(reference, {
    id: reference.id,
    name,
    order,
    isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateLevel(
  id: string,
  { name, order, isActive }: LevelInput
) {
  await updateDoc(doc(db, firestoreCollections.levels, id), {
    name,
    order,
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setLevelArchived(id: string, isArchived: boolean) {
  await updateDoc(doc(db, firestoreCollections.levels, id), {
    isArchived,
    updatedAt: serverTimestamp(),
  });
}

export async function setLevelActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.levels, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function listSciences(levelId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.sciences),
      where("levelId", "==", levelId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Science>(item));
}

export async function createScience(
  levelId: string,
  { name, order, isActive }: ScienceInput
) {
  const reference = doc(collection(db, firestoreCollections.sciences));

  await setDoc(reference, {
    id: reference.id,
    levelId,
    name,
    order,
    isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateScience(
  id: string,
  { name, order, isActive }: ScienceInput
) {
  await updateDoc(doc(db, firestoreCollections.sciences, id), {
    name,
    order,
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setScienceArchived(id: string, isArchived: boolean) {
  await updateDoc(doc(db, firestoreCollections.sciences, id), {
    isArchived,
    updatedAt: serverTimestamp(),
  });
}

export async function setScienceActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.sciences, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function listMatn(scienceId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.matn),
      where("scienceId", "==", scienceId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Matn>(item));
}

export async function createMatn(
  levelId: string,
  scienceId: string,
  input: MatnInput
) {
  const reference = doc(collection(db, firestoreCollections.matn));
  const { description, ...matnData } = input;

  await setDoc(reference, {
    id: reference.id,
    levelId,
    scienceId,
    ...matnData,
    ...(description?.trim()
      ? { description: description.trim() }
      : {}),
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateMatn(id: string, input: MatnInput) {
  const { description, ...matnData } = input;

  await updateDoc(doc(db, firestoreCollections.matn, id), {
    ...matnData,
    description: description?.trim() || deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function setMatnArchived(id: string, isArchived: boolean) {
  await updateDoc(doc(db, firestoreCollections.matn, id), {
    isArchived,
    updatedAt: serverTimestamp(),
  });
}

export async function setMatnActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.matn, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export function getFirestoreErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  if (code === "permission-denied") {
    return "لا تملك صلاحية إجراء هذا التغيير.";
  }

  if (code === "unavailable") {
    return "تعذر الاتصال بالخدمة. يرجى المحاولة مرة أخرى.";
  }

  return "تعذر إتمام العملية. يرجى المحاولة مرة أخرى.";
}

