"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { toast } from "sonner";

import { ArchiveContentDialog } from "@/components/admin/archive-content-dialog";
import { StructureList } from "@/components/admin/matn-structure/structure-list";
import type { StructureListItem } from "@/components/admin/matn-structure/structure-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createBook,
  createBookCollection,
  createPdfBook,
  getFirestoreErrorMessage,
  listBookCollections,
  listBooks,
  reorderBookCollections,
  reorderBooks,
  replaceBookPdf,
  setBookActive,
  setBookArchived,
  setBookCollectionActive,
  setBookCollectionArchived,
  updateBook,
  updateBookCollection,
} from "@/lib/firestore/books";
import { listLevels, listSciences } from "@/lib/firestore/content";
import { validateBookPdfFile } from "@/lib/storage/books";
import type { Book, BookCollection, Level, Science } from "@/types";

import { BookCollectionFormDialog, type BookCollectionFormValues } from "./book-collection-form-dialog";
import { BookFormDialog, type BookFormValues } from "./book-form-dialog";

type ArchiveTarget =
  | { type: "collection"; item: BookCollection }
  | { type: "book"; item: Book };

const toStructureItems = <T extends StructureListItem>(items: readonly T[]) => items;

export function BookAdminWorkspace() {
  const [levels, setLevels] = React.useState<Level[]>([]);
  const [sciences, setSciences] = React.useState<Science[]>([]);
  const [collections, setCollections] = React.useState<BookCollection[]>([]);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [selectedLevelId, setSelectedLevelId] = React.useState<string | null>(null);
  const [selectedScienceId, setSelectedScienceId] = React.useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState({ levels: true, sciences: false, collections: false, books: false });
  const [busy, setBusy] = React.useState(false);
  const [collectionEditor, setCollectionEditor] = React.useState<BookCollection | null | undefined>(undefined);
  const [bookEditor, setBookEditor] = React.useState<Book | null | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = React.useState<ArchiveTarget | null>(null);

  const selectedLevel = levels.find((item) => item.id === selectedLevelId) ?? null;
  const selectedScience = sciences.find((item) => item.id === selectedScienceId) ?? null;
  const selectedCollection = collections.find((item) => item.id === selectedCollectionId) ?? null;
  const selectedBook = books.find((item) => item.id === selectedBookId) ?? null;

  const reportError = React.useCallback((error: unknown) => {
    if (process.env.NODE_ENV === "development") console.error("Book administration operation failed.", error);
    toast.error(getFirestoreErrorMessage(error));
  }, []);

  const loadLevels = React.useCallback(async () => {
    setLoading((current) => ({ ...current, levels: true }));
    try { setLevels(await listLevels()); } catch (error) { reportError(error); } finally { setLoading((current) => ({ ...current, levels: false })); }
  }, [reportError]);

  const loadSciences = React.useCallback(async (levelId: string) => {
    setLoading((current) => ({ ...current, sciences: true }));
    try { setSciences(await listSciences(levelId)); } catch (error) { reportError(error); } finally { setLoading((current) => ({ ...current, sciences: false })); }
  }, [reportError]);

  const loadCollections = React.useCallback(async (levelId: string, scienceId: string) => {
    if (!levelId.trim() || !scienceId.trim()) return;

    setLoading((current) => ({ ...current, collections: true }));
    try { setCollections(await listBookCollections(levelId, scienceId)); } catch (error) { reportError(error); } finally { setLoading((current) => ({ ...current, collections: false })); }
  }, [reportError]);

  const loadBooks = React.useCallback(async (levelId: string, scienceId: string, collectionId: string | null) => {
    if (!levelId.trim() || !scienceId.trim()) return;

    setLoading((current) => ({ ...current, books: true }));
    try { setBooks(await listBooks({ levelId, scienceId, ...(collectionId ? { collectionId } : {}) })); } catch (error) { reportError(error); } finally { setLoading((current) => ({ ...current, books: false })); }
  }, [reportError]);

  React.useEffect(() => { void loadLevels(); }, [loadLevels]);

  function selectLevel(level: Level) {
    setSelectedLevelId(level.id); setSelectedScienceId(null); setSelectedCollectionId(null); setSelectedBookId(null); setSciences([]); setCollections([]); setBooks([]); void loadSciences(level.id);
  }
  function selectScience(science: Science) {
    const levelId = selectedLevelId?.trim();
    const scienceId = science.id.trim();

    setSelectedScienceId(science.id); setSelectedCollectionId(null); setSelectedBookId(null); setCollections([]); setBooks([]);

    if (!levelId || !scienceId) return;

    void loadCollections(levelId, scienceId);
    void loadBooks(levelId, scienceId, null);
  }
  function selectCollection(collectionId: string | null) {
    setSelectedCollectionId(collectionId); setSelectedBookId(null); if (selectedLevelId && selectedScienceId) void loadBooks(selectedLevelId, selectedScienceId, collectionId);
  }

  async function submitCollection(values: BookCollectionFormValues) {
    if (!selectedLevel || !selectedScience) return;
    setBusy(true);
    try {
      if (collectionEditor) { await updateBookCollection(collectionEditor.id, values); toast.success("تم تحديث مجموعة الكتب."); }
      else { await createBookCollection(selectedLevel.id, selectedScience.id, values); toast.success("تم إنشاء مجموعة الكتب."); }
      await loadCollections(selectedLevel.id, selectedScience.id); setCollectionEditor(undefined);
    } catch (error) { reportError(error); } finally { setBusy(false); }
  }

  async function submitBook(values: BookFormValues) {
    if (!selectedLevel || !selectedScience) return;
    setBusy(true);
    try {
      const input = { levelId: selectedLevel.id, scienceId: selectedScience.id, ...(values.collectionId ? { collectionId: values.collectionId } : {}), title: values.title, author: values.author, description: values.description, type: values.type, pageCount: bookEditor?.pageCount ?? 0, isActive: values.isActive };
      if (values.file) validateBookPdfFile(values.file);
      if (bookEditor) {
        if (bookEditor.type === "PDF" && values.file) {
          const count = await getPdfPageCount(values.file);
          await replaceBookPdf(bookEditor, input, values.file, count);
        } else { await updateBook(bookEditor.id, input); }
        toast.success("تم تحديث الكتاب.");
      } else if (values.type === "PDF") {
        if (!values.file) throw new Error("A PDF is required.");
        const count = await getPdfPageCount(values.file);
        await createPdfBook({ ...input, type: "PDF", pageCount: count }, values.file);
        toast.success("تم إنشاء كتاب PDF.");
      } else {
        await createBook({ ...input, type: "TEXT", pageCount: 0 });
        toast.success("تم إنشاء الكتاب النصي.");
      }
      await loadBooks(selectedLevel.id, selectedScience.id, selectedCollectionId); setBookEditor(undefined);
    } catch (error) { reportError(error); } finally { setBusy(false); }
  }

  async function archiveConfirm() {
    if (!archiveTarget || !selectedLevel || !selectedScience) return;
    setBusy(true);
    try {
      const archiving = !archiveTarget.item.isArchived;
      if (archiveTarget.type === "collection") { await setBookCollectionArchived(archiveTarget.item.id, selectedLevel.id, selectedScience.id, archiving); await loadCollections(selectedLevel.id, selectedScience.id); if (archiving && selectedCollectionId === archiveTarget.item.id) selectCollection(null); }
      else { await setBookArchived(archiveTarget.item.id, { levelId: selectedLevel.id, scienceId: selectedScience.id, ...(selectedCollectionId ? { collectionId: selectedCollectionId } : {}) }, archiving); await loadBooks(selectedLevel.id, selectedScience.id, selectedCollectionId); if (archiving && selectedBookId === archiveTarget.item.id) setSelectedBookId(null); }
      toast.success(archiving ? "تمت أرشفة العنصر." : "تمت استعادة العنصر."); setArchiveTarget(null);
    } catch (error) { reportError(error); } finally { setBusy(false); }
  }

  return <div className="mt-8 space-y-5">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"><span>المسار:</span><span>الكتب</span>{selectedLevel ? <><ChevronLeft className="size-4 rtl:rotate-180" /><Badge variant="secondary">{selectedLevel.name}</Badge></> : null}{selectedScience ? <><ChevronLeft className="size-4 rtl:rotate-180" /><Badge variant="secondary">{selectedScience.name}</Badge></> : null}{selectedCollection ? <><ChevronLeft className="size-4 rtl:rotate-180" /><Badge variant="secondary">{selectedCollection.title}</Badge></> : null}</div>
    <div className="grid gap-4 xl:grid-cols-3">
      <SimpleSelector title="المستويات" items={levels} selectedId={selectedLevelId} loading={loading.levels} empty="لا توجد مستويات بعد." onSelect={selectLevel} />
      <SimpleSelector title="العلوم" items={sciences} selectedId={selectedScienceId} loading={loading.sciences} empty={selectedLevel ? "لا توجد علوم في هذا المستوى." : "اختر مستوى أولًا."} disabled={!selectedLevel} onSelect={selectScience} />
      <StructureList title="مجموعات الكتب" description={selectedScience ? "المجموعات الاختيارية داخل العلم المحدد." : "اختر علمًا أولًا."} createLabel="إضافة" emptyMessage={selectedScience ? "لا توجد مجموعات كتب بعد." : "اختر علمًا أولًا."} items={toStructureItems(collections)} group="book-collections" selectedItemId={selectedCollectionId} isLoading={loading.collections} isDisabled={!selectedScience} isBusy={busy} onCreate={() => setCollectionEditor(null)} onSelect={(item) => selectCollection(item.id)} onEdit={(item) => setCollectionEditor(collections.find((entry) => entry.id === item.id) ?? null)} onSetActive={(item) => { void (async () => { setBusy(true); try { await setBookCollectionActive(item.id, !item.isActive); await loadCollections(selectedLevel!.id, selectedScience!.id); toast.success("تم تحديث حالة المجموعة."); } catch (error) { reportError(error); } finally { setBusy(false); } })(); }} onSetArchived={(item) => { const collection = collections.find((entry) => entry.id === item.id); if (collection) setArchiveTarget({ type: "collection", item: collection }); }} onReorder={(items) => { void (async () => { setBusy(true); try { await reorderBookCollections(items); toast.success("تم تحديث ترتيب المجموعات."); } catch (error) { reportError(error); await loadCollections(selectedLevel!.id, selectedScience!.id); } finally { setBusy(false); } })(); }} />
    </div>
    {selectedScience ? <section className="space-y-4 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">الكتب</h2><p className="mt-1 text-sm text-muted-foreground">{selectedCollection ? `كتب مجموعة «${selectedCollection.title}».` : "كتب مباشرة تحت العلم دون مجموعة."}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={selectedCollectionId ? "outline" : "secondary"} onClick={() => selectCollection(null)}>كتب مباشرة</Button><Button size="sm" onClick={() => setBookEditor(null)}>إضافة كتاب</Button></div></div>
      <StructureList title="" description="" createLabel="إضافة كتاب" emptyMessage="لا توجد كتب في هذا الموضع بعد." items={toStructureItems(books)} group={`books-${selectedCollectionId ?? "direct"}`} selectedItemId={selectedBookId} isLoading={loading.books} isBusy={busy} onCreate={() => setBookEditor(null)} onSelect={(item) => setSelectedBookId(item.id)} onEdit={(item) => setBookEditor(books.find((entry) => entry.id === item.id) ?? null)} onSetActive={(item) => { void (async () => { setBusy(true); try { await setBookActive(item.id, !item.isActive); await loadBooks(selectedLevel!.id, selectedScience!.id, selectedCollectionId); toast.success("تم تحديث حالة الكتاب."); } catch (error) { reportError(error); } finally { setBusy(false); } })(); }} onSetArchived={(item) => { const book = books.find((entry) => entry.id === item.id); if (book) setArchiveTarget({ type: "book", item: book }); }} onReorder={(items) => { void (async () => { setBusy(true); try { await reorderBooks(items); toast.success("تم تحديث ترتيب الكتب."); } catch (error) { reportError(error); await loadBooks(selectedLevel!.id, selectedScience!.id, selectedCollectionId); } finally { setBusy(false); } })(); }} />
      {selectedBook ? <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="text-sm"><span className="font-medium">{selectedBook.title}</span><span className="mx-2 text-muted-foreground">·</span><span className="text-muted-foreground">{selectedBook.type === "PDF" ? `${selectedBook.pageCount} صفحة PDF` : `${selectedBook.pageCount} صفحة نصية`}</span></div>{selectedBook.type === "TEXT" ? (selectedBook.pageCount === 0 ? <Button size="sm" render={<Link href={`/admin/books/${selectedBook.id}/text`} />}><FileText />إدخال النص</Button> : <p className="text-sm text-muted-foreground">تم حفظ الصفحات النصية الأولية.</p>) : null}</div> : null}
    </section> : null}
    <BookCollectionFormDialog item={collectionEditor ?? null} open={collectionEditor !== undefined} isSubmitting={busy} onOpenChange={(open) => { if (!open && !busy) setCollectionEditor(undefined); }} onSubmit={(values) => void submitCollection(values)} />
    <BookFormDialog item={bookEditor ?? null} collections={collections} initialCollectionId={selectedCollectionId} open={bookEditor !== undefined} isSubmitting={busy} onOpenChange={(open) => { if (!open && !busy) setBookEditor(undefined); }} onSubmit={(values) => void submitBook(values)} />
    <ArchiveContentDialog itemName={archiveTarget?.item.title ?? null} isArchived={archiveTarget?.item.isArchived ?? false} isSubmitting={busy} onOpenChange={(open) => { if (!open && !busy) setArchiveTarget(null); }} onConfirm={() => void archiveConfirm()} />
  </div>;
}

function SimpleSelector<T extends { id: string; name: string; isArchived: boolean; isActive: boolean }>({ title, items, selectedId, loading, empty, disabled = false, onSelect }: { title: string; items: readonly T[]; selectedId: string | null; loading: boolean; empty: string; disabled?: boolean; onSelect: (item: T) => void }) {
  const visible = items.filter((item) => !item.isArchived);
  return <section className="min-h-56 rounded-xl border bg-card"><div className="border-b p-4"><h2 className="font-semibold">{title}</h2></div><div className="p-2">{loading ? <p className="p-3 text-sm text-muted-foreground">جارٍ التحميل...</p> : disabled || visible.length === 0 ? <p className="p-3 text-sm leading-6 text-muted-foreground">{empty}</p> : <ul className="space-y-1">{visible.map((item) => <li key={item.id}><button type="button" className={`w-full rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-muted ${selectedId === item.id ? "bg-accent" : ""}`} onClick={() => onSelect(item)}><span className="font-medium">{item.name}</span>{!item.isActive ? <span className="me-2 text-xs text-muted-foreground">غير نشط</span> : null}</button></li>)}</ul>}</div></section>;
}

async function getPdfPageCount(file: File) {
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const documentProxy = await loadingTask.promise;
  try { return documentProxy.numPages; } finally { await loadingTask.destroy(); }
}
