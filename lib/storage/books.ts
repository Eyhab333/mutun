import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "@/lib/firebase";

const PDF_CONTENT_TYPE = "application/pdf";
const PDF_MAX_BYTES = 200 * 1024 * 1024;

export class BookPdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookPdfValidationError";
  }
}

function createGeneratedPdfName() {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `source-${uniqueId}.pdf`;
}

function getBookPdfReference(storagePath: string) {
  if (!storagePath.startsWith("books/")) {
    throw new Error("Invalid book PDF storage path.");
  }

  return ref(storage, storagePath);
}

export function validateBookPdfFile(file: File) {
  if (file.type.trim().toLowerCase() !== PDF_CONTENT_TYPE) {
    throw new BookPdfValidationError("اختر ملف PDF فقط.");
  }

  if (file.size > PDF_MAX_BYTES) {
    throw new BookPdfValidationError("الحد الأقصى لملف PDF هو 200 MB.");
  }
}

export function createBookPdfStoragePath(bookId: string) {
  return `books/${bookId}/source/${createGeneratedPdfName()}`;
}

export async function uploadBookPdfFile({
  bookId,
  file,
}: {
  bookId: string;
  file: File;
}) {
  validateBookPdfFile(file);
  const storagePath = createBookPdfStoragePath(bookId);

  await uploadBytes(getBookPdfReference(storagePath), file, {
    contentType: PDF_CONTENT_TYPE,
  });

  return storagePath;
}

export async function deleteBookPdfFile(storagePath: string) {
  await deleteObject(getBookPdfReference(storagePath));
}

export async function getBookPdfFileUrl(storagePath: string) {
  return getDownloadURL(getBookPdfReference(storagePath));
}
