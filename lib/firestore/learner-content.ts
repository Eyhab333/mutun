import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { Query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  BrowseResumeLocation,
  Chapter,
  Level,
  Maqsad,
  Matn,
  Passage,
  Science,
  Section,
} from "@/types";

import type {
  ChapterParent,
  PassageParent,
  SectionParent,
} from "./matn-structure";
import { firestoreCollections, type FirestoreCollectionName } from "./collections";

type VisibleContent = {
  id: string;
  isActive: boolean;
  isArchived: boolean;
};

export type LearnerMatnContext = {
  level: Level;
  science: Science;
  matn: Matn;
};

function documentData<T extends { id: string }>(
  snapshot: { id: string; data: () => unknown }
) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function isVisibleContent(item: VisibleContent) {
  return item.isActive && !item.isArchived;
}

function sameOptionalId(actual?: string, expected?: string) {
  return actual === expected;
}

async function getVisibleDocument<T extends VisibleContent>(
  collectionName: FirestoreCollectionName,
  id: string
) {
  const snapshot = await getDoc(doc(db, collectionName, id));

  if (!snapshot.exists()) {
    return null;
  }

  const item = documentData<T>(snapshot);

  return isVisibleContent(item) ? item : null;
}

async function listVisible<T extends VisibleContent>(
  source: Query
) {
  const snapshot = await getDocs(source);

  return snapshot.docs
    .map((item) => documentData<T>(item))
    .filter(isVisibleContent);
}

export async function listActiveLevels() {
  return listVisible<Level>(
    query(collection(db, firestoreCollections.levels), orderBy("order", "asc"))
  );
}

export async function getActiveLevel(levelId: string) {
  return getVisibleDocument<Level>(firestoreCollections.levels, levelId);
}

export async function listActiveSciences(levelId: string) {
  return listVisible<Science>(
    query(
      collection(db, firestoreCollections.sciences),
      where("levelId", "==", levelId),
      orderBy("order", "asc")
    )
  );
}

export async function getActiveScience(levelId: string, scienceId: string) {
  const science = await getVisibleDocument<Science>(
    firestoreCollections.sciences,
    scienceId
  );

  return science?.levelId === levelId ? science : null;
}

export async function listActiveMatn(scienceId: string) {
  return listVisible<Matn>(
    query(
      collection(db, firestoreCollections.matn),
      where("scienceId", "==", scienceId),
      orderBy("order", "asc")
    )
  );
}

export async function getActiveMatn(
  levelId: string,
  scienceId: string,
  matnId: string
) {
  const matn = await getVisibleDocument<Matn>(firestoreCollections.matn, matnId);

  return matn?.levelId === levelId && matn.scienceId === scienceId ? matn : null;
}

export async function getActiveMatnContext(
  levelId: string,
  scienceId: string,
  matnId: string
): Promise<LearnerMatnContext | null> {
  const [level, science, matn] = await Promise.all([
    getActiveLevel(levelId),
    getActiveScience(levelId, scienceId),
    getActiveMatn(levelId, scienceId, matnId),
  ]);

  if (!level || !science || !matn) {
    return null;
  }

  return { level, science, matn };
}

export async function listActiveMaqasid(matnId: string) {
  return listVisible<Maqsad>(
    query(
      collection(db, firestoreCollections.maqasid),
      where("matnId", "==", matnId),
      orderBy("order", "asc")
    )
  );
}

export async function getActiveMaqsad(matnId: string, maqsadId: string) {
  const maqsad = await getVisibleDocument<Maqsad>(
    firestoreCollections.maqasid,
    maqsadId
  );

  return maqsad?.matnId === matnId ? maqsad : null;
}

export async function listActiveChapters({ matnId, maqsadId }: ChapterParent) {
  const constraints = [where("matnId", "==", matnId)];

  if (maqsadId) {
    constraints.push(where("maqsadId", "==", maqsadId));
  }

  const chapters = await listVisible<Chapter>(
    query(
      collection(db, firestoreCollections.chapters),
      ...constraints,
      orderBy("order", "asc")
    )
  );

  return chapters.filter((chapter) => sameOptionalId(chapter.maqsadId, maqsadId));
}

export async function getActiveChapter(
  parent: ChapterParent,
  chapterId: string
) {
  const chapter = await getVisibleDocument<Chapter>(
    firestoreCollections.chapters,
    chapterId
  );

  return chapter &&
    chapter.matnId === parent.matnId &&
    sameOptionalId(chapter.maqsadId, parent.maqsadId)
    ? chapter
    : null;
}

export async function listActiveSections({
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

  const sections = await listVisible<Section>(
    query(
      collection(db, firestoreCollections.sections),
      ...constraints,
      orderBy("order", "asc")
    )
  );

  return sections.filter(
    (section) =>
      sameOptionalId(section.maqsadId, maqsadId) &&
      sameOptionalId(section.chapterId, chapterId)
  );
}

export async function getActiveSection(
  parent: SectionParent,
  sectionId: string
) {
  const section = await getVisibleDocument<Section>(
    firestoreCollections.sections,
    sectionId
  );

  return section &&
    section.matnId === parent.matnId &&
    sameOptionalId(section.maqsadId, parent.maqsadId) &&
    sameOptionalId(section.chapterId, parent.chapterId)
    ? section
    : null;
}

export async function listActivePassages({
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

  const passages = await listVisible<Passage>(
    query(
      collection(db, firestoreCollections.passages),
      ...constraints,
      orderBy("order", "asc")
    )
  );

  return passages.filter(
    (passage) =>
      sameOptionalId(passage.maqsadId, maqsadId) &&
      sameOptionalId(passage.chapterId, chapterId) &&
      sameOptionalId(passage.sectionId, sectionId)
  );
}

export async function getActivePassage(
  parent: PassageParent,
  passageId: string
) {
  const passage = await getVisibleDocument<Passage>(
    firestoreCollections.passages,
    passageId
  );

  return passage &&
    passage.matnId === parent.matnId &&
    sameOptionalId(passage.maqsadId, parent.maqsadId) &&
    sameOptionalId(passage.chapterId, parent.chapterId) &&
    sameOptionalId(passage.sectionId, parent.sectionId)
    ? passage
    : null;
}

export async function validateBrowseResumeLocation(
  resume: Pick<
    BrowseResumeLocation,
    | "levelId"
    | "scienceId"
    | "matnId"
    | "maqsadId"
    | "chapterId"
    | "sectionId"
    | "passageId"
  >
) {
  const context = await getActiveMatnContext(
    resume.levelId,
    resume.scienceId,
    resume.matnId
  );

  if (!context) {
    return false;
  }

  const parent: PassageParent = { matnId: context.matn.id };

  if (context.matn.hasMaqasid) {
    if (!resume.maqsadId) {
      return !resume.chapterId && !resume.sectionId && !resume.passageId;
    }

    const maqsad = await getActiveMaqsad(context.matn.id, resume.maqsadId);

    if (!maqsad) {
      return false;
    }

    parent.maqsadId = maqsad.id;
  } else if (resume.maqsadId) {
    return false;
  }

  if (context.matn.hasChapters) {
    if (!resume.chapterId) {
      return !resume.sectionId && !resume.passageId;
    }

    const chapter = await getActiveChapter(
      { matnId: context.matn.id, ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}) },
      resume.chapterId
    );

    if (!chapter) {
      return false;
    }

    parent.chapterId = chapter.id;
  } else if (resume.chapterId) {
    return false;
  }

  if (context.matn.hasSections) {
    if (!resume.sectionId) {
      return !resume.passageId;
    }

    const section = await getActiveSection(
      {
        matnId: context.matn.id,
        ...(parent.maqsadId ? { maqsadId: parent.maqsadId } : {}),
        ...(parent.chapterId ? { chapterId: parent.chapterId } : {}),
      },
      resume.sectionId
    );

    if (!section) {
      return false;
    }

    parent.sectionId = section.id;
  } else if (resume.sectionId) {
    return false;
  }

  return resume.passageId ? Boolean(await getActivePassage(parent, resume.passageId)) : true;
}
