export type DraftBookPage = { tempId: string; text: string };

export type BookTextDraft = {
  version: 1;
  bookId: string;
  sourceText: string;
  pages: DraftBookPage[];
  updatedAt: string;
};

export function getBookTextDraftKey(bookId: string) {
  return `mutun:book-text-draft:${bookId}`;
}

export function createDraftBookPage(text = ""): DraftBookPage {
  const tempId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { tempId, text };
}

export function readBookTextDraft(bookId: string): BookTextDraft | null {
  try {
    const raw = window.localStorage.getItem(getBookTextDraftKey(bookId));
    if (!raw) return null;
    const draft: unknown = JSON.parse(raw);
    if (!draft || typeof draft !== "object") { window.localStorage.removeItem(getBookTextDraftKey(bookId)); return null; }
    const value = draft as Partial<BookTextDraft>;
    if (value.version !== 1 || value.bookId !== bookId || typeof value.sourceText !== "string" || !Array.isArray(value.pages) || !value.pages.length || !value.pages.every((page) => page && typeof page.tempId === "string" && typeof page.text === "string")) { window.localStorage.removeItem(getBookTextDraftKey(bookId)); return null; }
    return value as BookTextDraft;
  } catch { return null; }
}

export function saveBookTextDraft(bookId: string, sourceText: string, pages: readonly DraftBookPage[]) {
  const draft: BookTextDraft = { version: 1, bookId, sourceText, pages: pages.map((page) => ({ ...page })), updatedAt: new Date().toISOString() };
  try { window.localStorage.setItem(getBookTextDraftKey(bookId), JSON.stringify(draft)); } catch { /* recovery storage is optional */ }
}

export function removeBookTextDraft(bookId: string) {
  try { window.localStorage.removeItem(getBookTextDraftKey(bookId)); } catch { /* only this draft is ever touched */ }
}
