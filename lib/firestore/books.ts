import {
  collection,
  deleteField,
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
import {
  deleteBookPdfFile,
  uploadBookPdfFile,
} from "@/lib/storage/books";
import type {
  Book,
  BookCollection,
  BookPage,
  BookType,
  Level,
  Science,
} from "@/types";

import {
  firestoreCollections,
  getFirestoreCollectionPath,
} from "./collections";
import { getActiveLevel, getActiveScience, listActiveLevels, listActiveSciences } from "./learner-content";

export type BookCollectionInput = {
  title: string;
  description?: string;
  isActive: boolean;
};

export type BookInput = {
  levelId: string;
  scienceId: string;
  collectionId?: string;
  title: string;
  author?: string;
  description?: string;
  type: BookType;
  pageCount: number;
  pdfStoragePath?: string;
  isActive: boolean;
};

export type BookSiblingScope = Pick<Book, "levelId" | "scienceId"> & {
  collectionId?: string;
};

export type BookLibraryCollection = {
  collection: BookCollection;
  books: Book[];
};

export type BookLibraryScience = {
  science: Science;
  directBooks: Book[];
  collections: BookLibraryCollection[];
};

export type BookLibraryLevel = {
  level: Level;
  sciences: BookLibraryScience[];
};

export type ActiveBookContext = {
  level: Level;
  science: Science;
  collection: BookCollection | null;
  book: Book;
};

type BookCollectionKey = "bookCollections" | "books" | "bookPages";

type BookCollectionContext = {
  levelId?: string;
  scienceId?: string;
  collectionId?: string;
};

export function getFirestoreErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
}

function documentData<T extends { id: string }>(
  snapshot: { id: string; data: () => unknown }
) {
  return { ...(snapshot.data() as Omit<T, "id">), id: snapshot.id } as T;
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function nextOrder(items: readonly { order: number }[]) {
  return Math.max(0, ...items.map((item) => item.order)) + 1;
}

function getBookCollectionReference(
  operation: string,
  collectionKey: BookCollectionKey,
  context: BookCollectionContext = {}
) {
  const path = firestoreCollections[collectionKey];

  if (process.env.NODE_ENV === "development") {
    console.info("Firestore books collection reference.", {
      operation,
      collectionKey,
      path,
      levelId: context.levelId,
      scienceId: context.scienceId,
      collectionId: context.collectionId,
    });
  }

  return collection(db, getFirestoreCollectionPath(collectionKey));
}

function requireBookScope(
  operation: string,
  levelId: string,
  scienceId: string
) {
  if (!levelId.trim() || !scienceId.trim()) {
    throw new Error(`${operation} requires a level and science identifier.`);
  }
}

function isVisible<T extends { isActive: boolean; isArchived: boolean }>(item: T) {
  return item.isActive && !item.isArchived;
}

function requireValidPageCount(pageCount: number) {
  if (!Number.isInteger(pageCount) || pageCount < 0) {
    throw new Error("Invalid book page count.");
  }
}

function getCollectionReference(id: string) {
  return doc(db, getFirestoreCollectionPath("bookCollections"), id);
}

function getBookReference(id: string) {
  return doc(db, getFirestoreCollectionPath("books"), id);
}

export async function getBookCollection(id: string) {
  const snapshot = await getDoc(getCollectionReference(id));
  return snapshot.exists() ? documentData<BookCollection>(snapshot) : null;
}

export async function getBook(id: string) {
  const snapshot = await getDoc(getBookReference(id));
  return snapshot.exists() ? documentData<Book>(snapshot) : null;
}

export async function listBookCollections(
  levelId: string,
  scienceId: string
) {
  requireBookScope("listBookCollections", levelId, scienceId);

  const snapshot = await getDocs(
    query(
      getBookCollectionReference("listBookCollections", "bookCollections", {
        levelId,
        scienceId,
      }),
      where("levelId", "==", levelId),
      where("scienceId", "==", scienceId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<BookCollection>(item));
}

export async function createBookCollection(
  levelId: string,
  scienceId: string,
  input: BookCollectionInput
) {
  const siblings = await listBookCollections(levelId, scienceId);
  const reference = doc(
    getBookCollectionReference("createBookCollection", "bookCollections", {
      levelId,
      scienceId,
    })
  );
  const description = optionalText(input.description);

  await setDoc(reference, {
    id: reference.id,
    levelId,
    scienceId,
    title: input.title.trim(),
    ...(description ? { description } : {}),
    order: nextOrder(siblings.filter((item) => !item.isArchived)),
    isActive: input.isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function updateBookCollection(
  id: string,
  input: BookCollectionInput
) {
  const description = optionalText(input.description);

  await updateDoc(getCollectionReference(id), {
    title: input.title.trim(),
    description: description ?? deleteField(),
    isActive: input.isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setBookCollectionActive(id: string, isActive: boolean) {
  await updateDoc(getCollectionReference(id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setBookCollectionArchived(
  id: string,
  levelId: string,
  scienceId: string,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextOrder(
          (await listBookCollections(levelId, scienceId)).filter(
            (item) => !item.isArchived
          )
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(getCollectionReference(id), update);
}

export async function reorderBookCollections(
  items: readonly { id: string; order: number }[]
) {
  const batch = writeBatch(db);
  let hasChanges = false;

  items.forEach((item, index) => {
    const order = index + 1;

    if (item.order !== order) {
      batch.update(getCollectionReference(item.id), {
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

export async function listBooksForScience(levelId: string, scienceId: string) {
  requireBookScope("listBooksForScience", levelId, scienceId);

  const snapshot = await getDocs(
    query(
      getBookCollectionReference("listBooksForScience", "books", {
        levelId,
        scienceId,
      }),
      where("levelId", "==", levelId),
      where("scienceId", "==", scienceId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<Book>(item));
}

export async function listBooks(scope: BookSiblingScope) {
  const books = await listBooksForScience(scope.levelId, scope.scienceId);

  return books.filter((book) =>
    scope.collectionId
      ? book.collectionId === scope.collectionId
      : !book.collectionId
  );
}

async function createBookAtReference(
  reference: ReturnType<typeof doc>,
  input: BookInput
) {
  requireValidPageCount(input.pageCount);
  const siblings = await listBooks(input);
  const title = input.title.trim();

  if (!title) {
    throw new Error("A book title is required.");
  }

  if (input.type === "PDF" && !input.pdfStoragePath) {
    throw new Error("A PDF book requires a storage path.");
  }

  const author = optionalText(input.author);
  const description = optionalText(input.description);

  await setDoc(reference, {
    id: reference.id,
    levelId: input.levelId,
    scienceId: input.scienceId,
    ...(input.collectionId ? { collectionId: input.collectionId } : {}),
    title,
    ...(author ? { author } : {}),
    ...(description ? { description } : {}),
    type: input.type,
    pageCount: input.pageCount,
    ...(input.pdfStoragePath ? { pdfStoragePath: input.pdfStoragePath } : {}),
    order: nextOrder(siblings.filter((item) => !item.isArchived)),
    isActive: input.isActive,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createBook(input: BookInput) {
  const reference = doc(
    getBookCollectionReference("createBook", "books", input)
  );
  await createBookAtReference(reference, input);
  return reference.id;
}

export async function createPdfBook(
  input: Omit<BookInput, "pdfStoragePath" | "pageCount"> & { pageCount: number },
  file: File
) {
  const reference = doc(
    getBookCollectionReference("createPdfBook", "books", input)
  );
  let storagePath: string | null = null;

  try {
    storagePath = await uploadBookPdfFile({ bookId: reference.id, file });
    await createBookAtReference(reference, { ...input, pdfStoragePath: storagePath });
    return reference.id;
  } catch (error) {
    if (storagePath) {
      try {
        await deleteBookPdfFile(storagePath);
      } catch (cleanupError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to remove an orphaned book PDF.", cleanupError);
        }
      }
    }

    throw error;
  }
}

export async function updateBook(id: string, input: BookInput) {
  requireValidPageCount(input.pageCount);
  const title = input.title.trim();

  if (!title) {
    throw new Error("A book title is required.");
  }

  const author = optionalText(input.author);
  const description = optionalText(input.description);

  await updateDoc(getBookReference(id), {
    collectionId: input.collectionId ?? deleteField(),
    title,
    author: author ?? deleteField(),
    description: description ?? deleteField(),
    pageCount: input.pageCount,
    isActive: input.isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function replaceBookPdf(
  book: Book,
  input: BookInput,
  file: File,
  pageCount: number
) {
  requireValidPageCount(pageCount);

  if (!input.title.trim()) {
    throw new Error("A book title is required.");
  }

  const storagePath = await uploadBookPdfFile({ bookId: book.id, file });

  try {
    await updateDoc(getBookReference(book.id), {
      collectionId: input.collectionId ?? deleteField(),
      title: input.title.trim(),
      author: optionalText(input.author) ?? deleteField(),
      description: optionalText(input.description) ?? deleteField(),
      pageCount,
      isActive: input.isActive,
      pdfStoragePath: storagePath,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    try {
      await deleteBookPdfFile(storagePath);
    } catch (cleanupError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to remove a failed replacement book PDF.", cleanupError);
      }
    }

    throw error;
  }

  if (book.pdfStoragePath && book.pdfStoragePath !== storagePath) {
    try {
      await deleteBookPdfFile(book.pdfStoragePath);
    } catch (cleanupError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to remove an old book PDF.", cleanupError);
      }
    }
  }
}

export async function setBookActive(id: string, isActive: boolean) {
  await updateDoc(getBookReference(id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setBookArchived(
  id: string,
  scope: BookSiblingScope,
  isArchived: boolean
) {
  const update = isArchived
    ? { isArchived, updatedAt: serverTimestamp() }
    : {
        isArchived,
        order: nextOrder(
          (await listBooks(scope)).filter((item) => !item.isArchived)
        ),
        updatedAt: serverTimestamp(),
      };

  await updateDoc(getBookReference(id), update);
}

export async function reorderBooks(items: readonly { id: string; order: number }[]) {
  const batch = writeBatch(db);
  let hasChanges = false;

  items.forEach((item, index) => {
    const order = index + 1;

    if (item.order !== order) {
      batch.update(getBookReference(item.id), {
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

export async function listBookPages(bookId: string) {
  const snapshot = await getDocs(
    query(
      getBookCollectionReference("listBookPages", "bookPages"),
      where("bookId", "==", bookId),
      orderBy("order", "asc")
    )
  );

  return snapshot.docs.map((item) => documentData<BookPage>(item));
}

export async function createInitialBookPages(
  bookId: string,
  pageTexts: readonly string[]
) {
  const normalizedTexts = pageTexts.map((text) => text.trim());

  if (
    normalizedTexts.length === 0 ||
    normalizedTexts.some((text) => !text) ||
    normalizedTexts.length > 499
  ) {
    throw new Error("Invalid initial book pages.");
  }

  const book = await getBook(bookId);

  if (!book || book.type !== "TEXT" || book.pageCount !== 0) {
    throw new Error("This text book cannot accept an initial page batch.");
  }

  const batch = writeBatch(db);

  normalizedTexts.forEach((text, index) => {
    const reference = doc(
      getBookCollectionReference("createInitialBookPages", "bookPages")
    );
    batch.set(reference, {
      id: reference.id,
      bookId,
      text,
      order: index + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.update(getBookReference(bookId), {
    pageCount: normalizedTexts.length,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  return normalizedTexts.length;
}

export async function listActiveBookLibrary() {
  const levels = await listActiveLevels();

  const library = await Promise.all(
    levels.map(async (level) => {
      const sciences = await listActiveSciences(level.id);
      const scienceEntries = await Promise.all(
        sciences.map(async (science) => {
          const [collections, books] = await Promise.all([
            listBookCollections(level.id, science.id),
            listBooksForScience(level.id, science.id),
          ]);
          const visibleBooks = books.filter(isVisible);
          const visibleCollections = collections
            .filter(isVisible)
            .map((collection) => ({
              collection,
              books: visibleBooks.filter(
                (book) => book.collectionId === collection.id
              ),
            }))
            .filter((entry) => entry.books.length > 0);
          const directBooks = visibleBooks.filter((book) => !book.collectionId);

          return {
            science,
            directBooks,
            collections: visibleCollections,
          } satisfies BookLibraryScience;
        })
      );

      return {
        level,
        sciences: scienceEntries.filter(
          (science) =>
            science.directBooks.length > 0 || science.collections.length > 0
        ),
      } satisfies BookLibraryLevel;
    })
  );

  return library.filter((level) => level.sciences.length > 0);
}

export async function getActiveBookContext(bookId: string) {
  const book = await getBook(bookId);

  if (!book || !isVisible(book)) {
    return null;
  }

  const [level, science, collection] = await Promise.all([
    getActiveLevel(book.levelId),
    getActiveScience(book.levelId, book.scienceId),
    book.collectionId ? getBookCollection(book.collectionId) : Promise.resolve(null),
  ]);

  if (
    !level ||
    !science ||
    (book.collectionId && (!collection || !isVisible(collection)))
  ) {
    return null;
  }

  return { level, science, collection, book } satisfies ActiveBookContext;
}
