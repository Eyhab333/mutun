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
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  deletePassageResourceFile,
  uploadPassageResourceFile,
  validatePassageResourceFile,
} from "@/lib/storage/passage-resources";
import type { PassageResource, PassageResourceType } from "@/types";

import { firestoreCollections } from "./collections";

export type PassageResourceInput = {
  type: PassageResourceType;
  title?: string;
  text?: string;
  url?: string;
  file?: File;
  isActive: boolean;
};

type OrderableResource = Pick<PassageResource, "id" | "order">;

type StoredResourceFields = {
  type: PassageResourceType;
  title?: string;
  text?: string;
  url?: string;
  storagePath?: string;
  isActive: boolean;
};

type NormalizedNoteResource = {
  type: "NOTE";
  title?: string;
  text: string;
  isActive: boolean;
};

type NormalizedYoutubeResource = {
  type: "YOUTUBE";
  title?: string;
  url: string;
  isActive: boolean;
};

type NormalizedFileResource = {
  type: "IMAGE" | "AUDIO";
  title?: string;
  url?: string;
  file?: File;
  isActive: boolean;
};

type NormalizedResource =
  | NormalizedNoteResource
  | NormalizedYoutubeResource
  | NormalizedFileResource;

function documentData<T extends { id: string }>(snapshot: {
  id: string;
  data: () => unknown;
}) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function nextSiblingOrder(items: readonly OrderableResource[]) {
  return Math.max(0, ...items.map((item) => item.order)) + 1;
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeInput({
  type,
  title,
  text,
  url,
  file,
  isActive,
}: PassageResourceInput): NormalizedResource {
  const normalizedTitle = title?.trim();
  const normalizedText = text?.trim();
  const normalizedUrl = url?.trim();

  if (type === "NOTE") {
    if (!normalizedText) {
      throw new Error("A note resource requires text.");
    }

    if (file || normalizedUrl) {
      throw new Error("A note resource cannot include a file or URL.");
    }

    return {
      type,
      ...(normalizedTitle ? { title: normalizedTitle } : {}),
      text: normalizedText,
      isActive,
    };
  }

  if (type === "YOUTUBE") {
    if (!normalizedUrl || !isValidUrl(normalizedUrl) || file) {
      throw new Error("A YouTube resource requires a URL.");
    }

    return {
      type,
      ...(normalizedTitle ? { title: normalizedTitle } : {}),
      url: normalizedUrl,
      isActive,
    };
  }

  if (file && normalizedUrl) {
    throw new Error("A file resource cannot use both a file and a URL.");
  }

  if (file) {
    validatePassageResourceFile(file, type);
  }

  if (normalizedUrl && !isValidUrl(normalizedUrl)) {
    throw new Error("A linked resource requires a URL.");
  }

  return {
    type,
    ...(normalizedTitle ? { title: normalizedTitle } : {}),
    ...(normalizedUrl ? { url: normalizedUrl } : {}),
    ...(file ? { file } : {}),
    isActive,
  };
}

function getStoredFields({
  resource,
  storagePath,
}: {
  resource: NormalizedResource;
  storagePath?: string;
}): StoredResourceFields {
  if (resource.type === "NOTE" || resource.type === "YOUTUBE") {
    return resource;
  }

  if (storagePath) {
    return {
      type: resource.type,
      ...(resource.title ? { title: resource.title } : {}),
      storagePath,
      isActive: resource.isActive,
    };
  }

  if (resource.url) {
    return {
      type: resource.type,
      ...(resource.title ? { title: resource.title } : {}),
      url: resource.url,
      isActive: resource.isActive,
    };
  }

  throw new Error("An image or audio resource requires a file or URL.");
}

async function cleanupUploadedFile(storagePath: string, reason: string) {
  try {
    await deletePassageResourceFile(storagePath);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(`Passage resource Storage cleanup failed after ${reason}.`, error);
    }
  }
}

async function uploadNewFileIfNeeded({
  passageId,
  resourceId,
  resource,
}: {
  passageId: string;
  resourceId: string;
  resource: NormalizedResource;
}) {
  if (resource.type === "NOTE" || resource.type === "YOUTUBE" || !resource.file) {
    return null;
  }

  return uploadPassageResourceFile({
    passageId,
    resourceId,
    resourceType: resource.type,
    file: resource.file,
  });
}

function getUpdateFields(resource: StoredResourceFields) {
  return {
    type: resource.type,
    title: resource.title ?? deleteField(),
    text: resource.text ?? deleteField(),
    url: resource.url ?? deleteField(),
    storagePath: resource.storagePath ?? deleteField(),
    isActive: resource.isActive,
    updatedAt: serverTimestamp(),
  };
}

export async function listPassageResources(passageId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, firestoreCollections.passageResources),
      where("passageId", "==", passageId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<PassageResource>(item));
}

export async function listActivePassageResources(passageId: string) {
  const resources = await listPassageResources(passageId);

  return resources.filter((resource) => resource.isActive && !resource.isArchived);
}

export async function createPassageResource(
  passageId: string,
  input: PassageResourceInput
) {
  const resource = normalizeInput(input);
  const siblings = await listPassageResources(passageId);
  const reference = doc(collection(db, firestoreCollections.passageResources));
  let uploadedStoragePath: string | null = null;

  try {
    uploadedStoragePath = await uploadNewFileIfNeeded({
      passageId,
      resourceId: reference.id,
      resource,
    });
    const storedFields = getStoredFields({
      resource,
      ...(uploadedStoragePath ? { storagePath: uploadedStoragePath } : {}),
    });

    await setDoc(reference, {
      id: reference.id,
      passageId,
      ...storedFields,
      order: nextSiblingOrder(siblings.filter((item) => !item.isArchived)),
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return reference.id;
  } catch (error) {
    if (uploadedStoragePath) {
      await cleanupUploadedFile(uploadedStoragePath, "Firestore creation failure");
    }

    throw error;
  }
}

export async function updatePassageResource(
  existing: PassageResource,
  input: PassageResourceInput
) {
  const resource = normalizeInput(input);
  let uploadedStoragePath: string | null = null;

  try {
    uploadedStoragePath = await uploadNewFileIfNeeded({
      passageId: existing.passageId,
      resourceId: existing.id,
      resource,
    });

    const shouldKeepExistingFile =
      resource.type === existing.type &&
      resource.type !== "NOTE" &&
      resource.type !== "YOUTUBE" &&
      !resource.file &&
      !resource.url &&
      Boolean(existing.storagePath);
    const storedFields = getStoredFields({
      resource,
      ...(uploadedStoragePath
        ? { storagePath: uploadedStoragePath }
        : shouldKeepExistingFile && existing.storagePath
          ? { storagePath: existing.storagePath }
          : {}),
    });

    await updateDoc(
      doc(db, firestoreCollections.passageResources, existing.id),
      getUpdateFields(storedFields)
    );

    if (
      existing.storagePath &&
      existing.storagePath !== storedFields.storagePath
    ) {
      await cleanupUploadedFile(existing.storagePath, "successful resource replacement");
    }
  } catch (error) {
    if (uploadedStoragePath) {
      await cleanupUploadedFile(uploadedStoragePath, "Firestore update failure");
    }

    throw error;
  }
}

export async function setPassageResourceActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, firestoreCollections.passageResources, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setPassageResourceArchived(
  id: string,
  passageId: string,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextSiblingOrder(
          (await listPassageResources(passageId)).filter((item) => !item.isArchived)
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(doc(db, firestoreCollections.passageResources, id), update);
}

export async function reorderPassageResources(
  passageId: string,
  items: readonly OrderableResource[]
) {
  const currentResources = (await listPassageResources(passageId)).filter(
    (item) => !item.isArchived
  );
  const currentResourcesById = new Map(
    currentResources.map((item) => [item.id, item])
  );

  if (
    items.length !== currentResources.length ||
    items.some((item) => !currentResourcesById.has(item.id))
  ) {
    throw new Error("Passage resource reorder contains invalid siblings.");
  }

  const batch = writeBatch(db);
  let hasChanges = false;

  items.forEach((item, index) => {
    const order = index + 1;
    const currentItem = currentResourcesById.get(item.id);

    if (currentItem && currentItem.order !== order) {
      batch.update(doc(db, firestoreCollections.passageResources, item.id), {
        order,
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
