import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { storage } from "@/lib/firebase";
import type { PassageResourceType } from "@/types";

type UploadablePassageResourceType = Extract<
  PassageResourceType,
  "IMAGE" | "AUDIO"
>;

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const AUDIO_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
]);

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 100 * 1024 * 1024;

const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

export class PassageResourceFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PassageResourceFileValidationError";
  }
}

function normalizeContentType(file: File) {
  return file.type.trim().toLowerCase();
}

function createGeneratedFileName(contentType: string) {
  const extension = FILE_EXTENSIONS[contentType];

  if (!extension) {
    throw new PassageResourceFileValidationError("نوع الملف غير مدعوم.");
  }

  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `file-${uniqueId}.${extension}`;
}

export function validatePassageResourceFile(
  file: File,
  resourceType: UploadablePassageResourceType
) {
  const contentType = normalizeContentType(file);
  const isImage = resourceType === "IMAGE";
  const allowedTypes = isImage ? IMAGE_CONTENT_TYPES : AUDIO_CONTENT_TYPES;
  const maxBytes = isImage ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;

  if (!allowedTypes.has(contentType)) {
    throw new PassageResourceFileValidationError(
      isImage
        ? "اختر صورة بصيغة JPG أو PNG أو WebP."
        : "اختر ملفًا صوتيًا بصيغة مدعومة."
    );
  }

  if (file.size > maxBytes) {
    throw new PassageResourceFileValidationError(
      isImage ? "الحد الأقصى للصورة هو 10 MB." : "الحد الأقصى للصوت هو 100 MB."
    );
  }

  return contentType;
}

export function createPassageResourceStoragePath({
  passageId,
  resourceId,
  file,
  resourceType,
}: {
  passageId: string;
  resourceId: string;
  file: File;
  resourceType: UploadablePassageResourceType;
}) {
  const contentType = validatePassageResourceFile(file, resourceType);
  const fileName = createGeneratedFileName(contentType);

  return `passage-resources/${passageId}/${resourceId}/${fileName}`;
}

function getStorageReference(storagePath: string) {
  if (!storagePath.startsWith("passage-resources/")) {
    throw new Error("Invalid passage-resource storage path.");
  }

  return ref(storage, storagePath);
}

export async function uploadPassageResourceFile({
  passageId,
  resourceId,
  resourceType,
  file,
}: {
  passageId: string;
  resourceId: string;
  resourceType: UploadablePassageResourceType;
  file: File;
}) {
  const contentType = validatePassageResourceFile(file, resourceType);
  const storagePath = createPassageResourceStoragePath({
    passageId,
    resourceId,
    file,
    resourceType,
  });

  await uploadBytes(getStorageReference(storagePath), file, { contentType });

  return storagePath;
}

export async function deletePassageResourceFile(storagePath: string) {
  await deleteObject(getStorageReference(storagePath));
}

export async function getPassageResourceFileUrl(storagePath: string) {
  return getDownloadURL(getStorageReference(storagePath));
}
