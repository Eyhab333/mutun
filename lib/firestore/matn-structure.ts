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
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  Chapter,
  Level,
  Maqsad,
  Matn,
  Passage,
  Science,
  Section,
} from "@/types";

import { firestoreCollections, type FirestoreCollectionName } from "./collections";

export type StructureInput = {
  title: string;
  isActive: boolean;
};

export type ChapterParent = {
  matnId: string;
  maqsadId?: string;
};

export type SectionParent = {
  matnId: string;
  maqsadId?: string;
  chapterId?: string;
};

export type PassageParent = {
  matnId: string;
  maqsadId?: string;
  chapterId?: string;
  sectionId?: string;
};

export type PassageInput = {
  text: string;
  isActive: boolean;
};

export type MatnStructureContext = {
  level: Level | null;
  science: Science | null;
  matn: Matn;
};

type OrderableStructureItem = {
  id: string;
  order: number;
};

function documentData<T extends { id: string }>(
  snapshot: { id: string; data: () => unknown }
) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

async function getDocument<T extends { id: string }>(
  collectionName: FirestoreCollectionName,
  id: string
) {
  const snapshot = await getDoc(doc(db, collectionName, id));

  return snapshot.exists() ? documentData<T>(snapshot) : null;
}

function nextSiblingOrder(items: readonly OrderableStructureItem[]) {
  const highestOrder = Math.max(0, ...items.map((item) => item.order));

  return highestOrder + 1;
}

async function persistSiblingOrder(
  collectionName: FirestoreCollectionName,
  items: readonly OrderableStructureItem[]
) {
  const batch = writeBatch(db);
  let hasChanges = false;

  items.forEach((item, index) => {
    const nextOrder = index + 1;

    if (item.order !== nextOrder) {
      batch.update(doc(db, collectionName, item.id), {
        order: nextOrder,
        updatedAt: serverTimestamp(),
      });
      hasChanges = true;
    }
  });

  if (hasChanges) {
    await batch.commit();
  }

  return hasChanges;
}

export async function getMatnStructureContext(matnId: string) {
  const matn = await getDocument<Matn>(firestoreCollections.matn, matnId);

  if (!matn) {
    return null;
  }

  const [level, science] = await Promise.all([
    getDocument<Level>(firestoreCollections.levels, matn.levelId),
    getDocument<Science>(firestoreCollections.sciences, matn.scienceId),
  ]);

  return { level, science, matn } satisfies MatnStructureContext;
}

export async function listMaqasid(matnId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.maqasid),
      where("matnId", "==", matnId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Maqsad>(item));
}

export async function createMaqsad(
  matnId: string,
  { title, isActive }: StructureInput
) {
  const siblings = await listMaqasid(matnId);
  const reference = doc(collection(db, firestoreCollections.maqasid));

  await setDoc(reference, {
    id: reference.id,
    matnId,
    title,
    order: nextSiblingOrder(siblings.filter((item) => !item.isArchived)),
    isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateMaqsad(
  id: string,
  { title, isActive }: StructureInput
) {
  await updateDoc(doc(db, firestoreCollections.maqasid, id), {
    title,
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setMaqsadActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.maqasid, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setMaqsadArchived(
  id: string,
  matnId: string,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextSiblingOrder(
          (await listMaqasid(matnId)).filter((item) => !item.isArchived)
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(doc(db, firestoreCollections.maqasid, id), update);
}

export async function reorderMaqasid(
  items: readonly { id: string; order: number }[]
) {
  return persistSiblingOrder(firestoreCollections.maqasid, items);
}

export async function listChapters({ matnId, maqsadId }: ChapterParent) {
  const constraints = [where("matnId", "==", matnId)];

  if (maqsadId) {
    constraints.push(where("maqsadId", "==", maqsadId));
  }

  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.chapters),
      ...constraints,
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Chapter>(item));
}

export async function createChapter(
  parent: ChapterParent,
  { title, isActive }: StructureInput
) {
  const siblings = await listChapters(parent);
  const reference = doc(collection(db, firestoreCollections.chapters));

  await setDoc(reference, {
    id: reference.id,
    matnId: parent.matnId,
    ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}),
    title,
    order: nextSiblingOrder(siblings.filter((item) => !item.isArchived)),
    isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateChapter(
  id: string,
  { title, isActive }: StructureInput
) {
  await updateDoc(doc(db, firestoreCollections.chapters, id), {
    title,
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setChapterActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.chapters, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setChapterArchived(
  id: string,
  parent: ChapterParent,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextSiblingOrder(
          (await listChapters(parent)).filter((item) => !item.isArchived)
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(doc(db, firestoreCollections.chapters, id), update);
}

export async function reorderChapters(
  items: readonly { id: string; order: number }[]
) {
  return persistSiblingOrder(firestoreCollections.chapters, items);
}

export async function listSections({
  matnId,
  maqsadId,
  chapterId,
}: SectionParent) {
  const constraints = [where("matnId", "==", matnId)];

  if (chapterId) {
    constraints.push(where("chapterId", "==", chapterId));
  } else if (maqsadId) {
    constraints.push(where("maqsadId", "==", maqsadId));
  }

  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.sections),
      ...constraints,
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Section>(item));
}

export async function createSection(
  parent: SectionParent,
  { title, isActive }: StructureInput
) {
  const siblings = await listSections(parent);
  const reference = doc(collection(db, firestoreCollections.sections));

  await setDoc(reference, {
    id: reference.id,
    matnId: parent.matnId,
    ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}),
    ...(parent.chapterId ? { chapterId: parent.chapterId } : {}),
    title,
    order: nextSiblingOrder(siblings.filter((item) => !item.isArchived)),
    isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateSection(
  id: string,
  { title, isActive }: StructureInput
) {
  await updateDoc(doc(db, firestoreCollections.sections, id), {
    title,
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setSectionActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.sections, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setSectionArchived(
  id: string,
  parent: SectionParent,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextSiblingOrder(
          (await listSections(parent)).filter((item) => !item.isArchived)
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(doc(db, firestoreCollections.sections, id), update);
}

export async function reorderSections(
  items: readonly { id: string; order: number }[]
) {
  return persistSiblingOrder(firestoreCollections.sections, items);
}

export async function listPassages({
  matnId,
  maqsadId,
  chapterId,
  sectionId,
}: PassageParent) {
  const constraints = [where("matnId", "==", matnId)];

  if (sectionId) {
    constraints.push(where("sectionId", "==", sectionId));
  } else if (chapterId) {
    constraints.push(where("chapterId", "==", chapterId));
  } else if (maqsadId) {
    constraints.push(where("maqsadId", "==", maqsadId));
  }

  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.passages),
      ...constraints,
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Passage>(item));
}

export async function createPassage(
  parent: PassageParent,
  { text, isActive }: PassageInput
) {
  const siblings = await listPassages(parent);
  const reference = doc(collection(db, firestoreCollections.passages));

  await setDoc(reference, {
    id: reference.id,
    matnId: parent.matnId,
    ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}),
    ...(parent.chapterId ? { chapterId: parent.chapterId } : {}),
    ...(parent.sectionId ? { sectionId: parent.sectionId } : {}),
    text,
    order: nextSiblingOrder(siblings.filter((item) => !item.isArchived)),
    isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function appendPassages(
  parent: PassageParent,
  texts: readonly string[]
) {
  if (!parent.matnId) {
    throw new Error("A passage batch requires a matn.");
  }

  const normalizedTexts = texts.map((text) => text.trim());

  if (normalizedTexts.length === 0 || normalizedTexts.some((text) => !text)) {
    throw new Error("A passage batch requires non-empty passages.");
  }

  // Firestore permits up to 500 writes in one batch. This workflow is intended
  // for normal matn-sized text batches, so fail before a partial write is possible.
  if (normalizedTexts.length > 500) {
    throw new Error("A passage batch is too large.");
  }

  // Read immediately before the batch so drafts opened earlier do not use stale
  // sibling ordering when normal Passage CRUD has run in the meantime.
  const siblings = await listPassages(parent);
  const firstOrder = nextSiblingOrder(
    siblings.filter((item) => !item.isArchived)
  );
  const batch = writeBatch(db);

  normalizedTexts.forEach((text, index) => {
    const reference = doc(collection(db, firestoreCollections.passages));

    batch.set(reference, {
      id: reference.id,
      matnId: parent.matnId,
      ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}),
      ...(parent.chapterId ? { chapterId: parent.chapterId } : {}),
      ...(parent.sectionId ? { sectionId: parent.sectionId } : {}),
      text,
      order: firstOrder + index,
      isActive: true,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();

  return normalizedTexts.length;
}

export async function updatePassage(
  id: string,
  { text, isActive }: PassageInput
) {
  await updateDoc(doc(db, firestoreCollections.passages, id), {
    text,
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setPassageActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.passages, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setPassageArchived(
  id: string,
  parent: PassageParent,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextSiblingOrder(
          (await listPassages(parent)).filter((item) => !item.isArchived)
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(doc(db, firestoreCollections.passages, id), update);
}

export async function reorderPassages(
  items: readonly { id: string; order: number }[]
) {
  return persistSiblingOrder(firestoreCollections.passages, items);
}
