"use client";

import * as React from "react";
import Link from "next/link";
import { DragDropProvider } from "@dnd-kit/react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBook, createInitialBookPages } from "@/lib/firestore/books";
import type { Book } from "@/types";
import { useSortableItems } from "@/components/admin/matn-structure/use-sortable-items";

import { createDraftBookPage, readBookTextDraft, removeBookTextDraft, saveBookTextDraft, type DraftBookPage } from "./book-text-draft-storage";
import { SortableDraftBookPage } from "./sortable-draft-book-page";

type Stage = "checking" | "input" | "recovery" | "split" | "unavailable";

function mergeText(first: string, second: string) { return `${first.trimEnd()}\n\n${second.trimStart()}`; }

export function BookTextEditor({ bookId }: { bookId: string }) {
  const [book, setBook] = React.useState<Book | null>(null);
  const [stage, setStage] = React.useState<Stage>("checking");
  const [sourceText, setSourceText] = React.useState("");
  const [pages, setPages] = React.useState<DraftBookPage[]>([]);
  const [saving, setSaving] = React.useState(false);
  const latest = React.useRef<{ sourceText: string; pages: DraftBookPage[] } | null>(null);

  React.useEffect(() => {
    let active = true;
    void getBook(bookId).then((nextBook) => {
      if (!active) return;
      if (!nextBook || nextBook.type !== "TEXT" || nextBook.pageCount !== 0) { setStage("unavailable"); return; }
      setBook(nextBook);
      const draft = readBookTextDraft(bookId);
      if (draft) { setSourceText(draft.sourceText); setPages(draft.pages); setStage("recovery"); } else setStage("input");
    }).catch(() => { if (active) setStage("unavailable"); });
    return () => { active = false; };
  }, [bookId]);

  React.useEffect(() => {
    latest.current = { sourceText, pages };
    if (stage !== "split" || !pages.length) return;
    const timeout = window.setTimeout(() => saveBookTextDraft(bookId, sourceText, pages), 300);
    return () => window.clearTimeout(timeout);
  }, [bookId, pages, sourceText, stage]);

  React.useEffect(() => () => { if (latest.current?.pages.length && stage === "split") saveBookTextDraft(bookId, latest.current.sourceText, latest.current.pages); }, [bookId, stage]);

  const sortable = React.useMemo(() => pages.map((page, index) => ({ ...page, id: page.tempId, order: index + 1, isArchived: false as const })), [pages]);
  const { handleDragEnd, orderedItems } = useSortableItems(sortable, saving, (items) => setPages(items.map(({ tempId, text }) => ({ tempId, text }))));

  function startSplit() {
    const text = sourceText.trim();
    if (!text) { toast.error("أدخل النص أولًا."); return; }
    const initialPages = [createDraftBookPage(text)];
    saveBookTextDraft(bookId, text, initialPages);
    setSourceText(text); setPages(initialPages); setStage("split");
  }
  function updatePage(id: string, text: string) { setPages((current) => current.map((page) => page.tempId === id ? { ...page, text } : page)); }
  function splitPage(id: string, position: number | null) {
    const page = pages.find((item) => item.tempId === id);
    if (!page || position === null || position <= 0 || position >= page.text.length) { toast.error("ضع المؤشر داخل النص في موضع التقسيم."); return; }
    const before = page.text.slice(0, position).trim(); const after = page.text.slice(position).trim();
    if (!before || !after) { toast.error("ضع المؤشر داخل النص في موضع التقسيم."); return; }
    setPages((current) => { const index = current.findIndex((item) => item.tempId === id); const next = [...current]; next.splice(index, 1, { ...page, text: before }, createDraftBookPage(after)); return next; });
  }
  function mergePrevious(id: string) { setPages((current) => { const index = current.findIndex((item) => item.tempId === id); if (index <= 0) return current; const next = [...current]; next.splice(index - 1, 2, { ...next[index - 1], text: mergeText(next[index - 1].text, next[index].text) }); return next; }); }
  function mergeNext(id: string) { setPages((current) => { const index = current.findIndex((item) => item.tempId === id); if (index < 0 || index === current.length - 1) return current; const next = [...current]; next.splice(index, 2, { ...next[index], text: mergeText(next[index].text, next[index + 1].text) }); return next; }); }
  function removePage(id: string) { if (pages.length === 1) { toast.error("لا يمكن ترك المسودة بلا صفحات."); return; } setPages((current) => current.filter((page) => page.tempId !== id)); }
  async function save() {
    const texts = pages.map((page) => page.text.trim());
    if (!texts.length || texts.some((text) => !text)) { toast.error("أكمل نص كل صفحة قبل الحفظ."); return; }
    setSaving(true);
    try { const count = await createInitialBookPages(bookId, texts); removeBookTextDraft(bookId); toast.success(`تم حفظ ${count} صفحات.`); window.location.assign("/admin/books"); } catch (error) { if (process.env.NODE_ENV === "development") console.error("Unable to save initial book pages.", error); toast.error("تعذر حفظ صفحات الكتاب."); } finally { setSaving(false); }
  }

  if (stage === "checking") return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">جارٍ تجهيز محرر الكتاب...</main>;
  if (stage === "unavailable") return <main className="mx-auto max-w-5xl px-4 py-10"><p className="text-sm leading-7 text-muted-foreground">هذا المحرر مخصص للكتب النصية الجديدة التي لم تحفظ صفحاتها بعد.</p><Button className="mt-4" variant="outline" render={<Link href="/admin/books" />}>العودة إلى الكتب</Button></main>;
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10"><header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4"><div><p className="text-sm text-muted-foreground">كتاب نصي</p><h1 className="text-2xl font-semibold">{book?.title}</h1></div><Button variant="outline" render={<Link href="/admin/books" />} disabled={saving}>العودة إلى الكتب</Button></header>
    {stage === "recovery" ? <section className="mt-8 space-y-4 rounded-xl border bg-card p-5"><h2 className="font-semibold">توجد مسودة محلية</h2><p className="text-sm text-muted-foreground">يمكنك استكمال صفحات النص المحفوظة، أو حذفها وبدء مسودة جديدة.</p><div className="flex flex-wrap gap-2"><Button onClick={() => setStage("split")}>استكمال المسودة</Button><Button variant="outline" onClick={() => { removeBookTextDraft(bookId); setSourceText(""); setPages([]); setStage("input"); }}>بدء مسودة جديدة</Button></div></section> : null}
    {stage === "input" ? <section className="mt-8 grid max-w-3xl gap-4"><div className="grid gap-2"><Label htmlFor="book-source">النص الكامل</Label><p className="text-sm leading-6 text-muted-foreground">يبدأ هذا النص كصفحة مسودة واحدة؛ لن يُقسّم تلقائيًا.</p><Textarea id="book-source" value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={18} className="min-h-80 resize-y whitespace-pre-wrap leading-7" autoFocus /></div><div className="flex justify-end"><Button onClick={startSplit}>بدء التقسيم</Button></div></section> : null}
    {stage === "split" ? <section className="mt-7 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">مراجعة الصفحات</h2><p className="text-sm text-muted-foreground">{pages.length} صفحات في هذه المسودة.</p></div><Button variant="outline" size="sm" disabled={saving} onClick={() => setPages((current) => [...current, createDraftBookPage()])}><Plus />إضافة صفحة</Button></div><DragDropProvider onDragEnd={handleDragEnd}><ol className="space-y-3">{orderedItems.map((page, index) => <SortableDraftBookPage key={page.tempId} page={page} index={index} hasNext={index < orderedItems.length - 1} group={`book-pages-${bookId}`} isBusy={saving} onTextChange={updatePage} onSplit={splitPage} onMergePrevious={mergePrevious} onMergeNext={mergeNext} onRemove={removePage} />)}</ol></DragDropProvider><div className="flex justify-end border-t pt-4"><Button disabled={saving} onClick={() => void save()}><Save />{saving ? "جارٍ الحفظ..." : "حفظ الصفحات"}</Button></div></section> : null}
  </main>;
}
