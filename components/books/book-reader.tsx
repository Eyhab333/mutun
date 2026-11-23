"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import { getActiveBookContext, listBookPages, type ActiveBookContext } from "@/lib/firestore/books";
import { advanceBookReadingCycle, getBookReadingSummary, startBookReadingCycle } from "@/lib/firestore/book-reading";
import { getBookPdfFileUrl } from "@/lib/storage/books";
import type { BookPage, BookReadingCycle } from "@/types";

const PdfBookViewer = dynamic(
  () => import("./pdf-book-viewer").then((module) => module.PdfBookViewer),
  { ssr: false, loading: () => <p className="py-16 text-center text-sm text-muted-foreground">جارٍ تجهيز القارئ...</p> }
);

function clampPage(value: number, pageCount: number) {
  return Math.min(Math.max(1, value), pageCount);
}

export function BookReader({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [context, setContext] = React.useState<ActiveBookContext | null>(null);
  const [pages, setPages] = React.useState<BookPage[]>([]);
  const [cycle, setCycle] = React.useState<BookReadingCycle | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [busy, setBusy] = React.useState(false);
  const [pageInput, setPageInput] = React.useState("1");

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const nextContext = await getActiveBookContext(bookId);
      if (!nextContext) { setState("not-found"); return; }
      const [nextPages, summary] = await Promise.all([
        nextContext.book.type === "TEXT" ? listBookPages(bookId) : Promise.resolve([]),
        user?.uid ? getBookReadingSummary(user.uid, bookId, getLocalDateKey()) : Promise.resolve(null),
      ]);
      if (nextContext.book.type === "TEXT" && nextPages.length !== nextContext.book.pageCount) {
        throw new Error("Text book pages are incomplete.");
      }
      setContext(nextContext);
      setPages(nextPages);
      setCycle(summary?.currentCycle ?? null);
      setPageInput(String(summary?.currentCycle?.currentPage ?? 1));
      if (nextContext.book.type === "PDF") {
        if (!nextContext.book.pdfStoragePath) throw new Error("PDF storage path missing.");
        setPdfUrl(await getBookPdfFileUrl(nextContext.book.pdfStoragePath));
      } else { setPdfUrl(null); }
      setState("ready");
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("Unable to load book reader.", error);
      setState("error");
    }
  }, [bookId, user?.uid]);

  React.useEffect(() => { void load(); }, [load]);

  async function start() {
    if (!user?.uid || !context) return;
    setBusy(true);
    try {
      const next = await startBookReadingCycle(user.uid, context.book.id, context.book.pageCount);
      setCycle(next as BookReadingCycle);
      setPageInput(String(next.currentPage));
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("Unable to start book reading cycle.", error);
      toast.error("تعذر بدء الختمة الآن.");
    } finally { setBusy(false); }
  }

  async function move(action: "previous" | "next" | "jump" | "complete", targetPage?: number) {
    if (!user?.uid || !context || !cycle) return;
    setBusy(true);
    try {
      const result = await advanceBookReadingCycle({
        userId: user.uid,
        bookId: context.book.id,
        cycleId: cycle.id,
        pageCount: context.book.pageCount,
        expectedCurrentPage: cycle.currentPage,
        action,
        ...(targetPage ? { targetPage } : {}),
        dateKey: getLocalDateKey(),
      });
      const nextCycle = { ...cycle, ...result };
      setCycle(nextCycle);
      setPageInput(String(result.currentPage));
      if (action === "complete") {
        toast.success("تمت الختمة بنجاح");
        router.push(`/books/${context.book.id}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("Unable to update book reading progress.", error);
      toast.error("تعذر تحديث تقدم القراءة.");
    } finally { setBusy(false); }
  }

  if (state === "loading") return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">جارٍ تحميل القارئ...</main>;
  if (state === "not-found") return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">هذا الكتاب غير متاح.</main>;
  if (state === "error") return <main className="mx-auto max-w-5xl px-4 py-10"><p className="text-sm text-muted-foreground">تعذر تحميل القارئ.</p><Button className="mt-3" size="sm" onClick={() => void load()}>إعادة المحاولة</Button></main>;
  if (!context) return null;

  const { book } = context;
  const currentPage = cycle?.currentPage ?? 1;
  const readThrough = cycle?.readThroughPage ?? 0;
  const progress = book.pageCount ? Math.round((readThrough / book.pageCount) * 100) : 0;
  const canComplete = Boolean(cycle && currentPage === book.pageCount && readThrough === book.pageCount - 1);
  const canGoNext = Boolean(cycle && currentPage < book.pageCount);
  const textPage = pages[currentPage - 1];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title={book.title} description="قراءة هادئة ضمن ختمة متتابعة." />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="min-w-0"><Link href={`/books/${book.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4 rtl:rotate-180" /> العودة إلى تفاصيل الكتاب</Link><h1 className="mt-1 text-lg font-semibold">الختمة {cycle?.cycleNumber ?? "الجديدة"}</h1></div>
        {cycle ? <p className="text-sm text-muted-foreground">تقدم الختمة: {readThrough} من {book.pageCount} · {progress}%</p> : null}
      </div>

      {!cycle ? (
        <section className="mt-8 rounded-xl border bg-card p-6 text-center"><p className="text-muted-foreground">ابدأ ختمة جديدة للمتابعة من الصفحة الأولى.</p><Button className="mt-4" disabled={busy || !book.pageCount} onClick={() => void start()}>بدء القراءة</Button></section>
      ) : (
        <>
          <section className="mt-6">
            {book.type === "PDF" ? (pdfUrl ? <PdfBookViewer fileUrl={pdfUrl} pageNumber={currentPage} onPageCount={(count) => { if (count !== book.pageCount && process.env.NODE_ENV === "development") console.warn("Book PDF page count differs from stored page count."); }} /> : <p className="py-16 text-center text-sm text-muted-foreground">جارٍ تحميل ملف الكتاب...</p>) : (
              <article className="min-h-80 rounded-xl border bg-card px-5 py-8 sm:px-10 sm:py-12"><p className="whitespace-pre-wrap text-lg leading-10 text-foreground">{textPage?.text}</p></article>
            )}
          </section>

          <section className="mt-5 flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">موضعك الحالي: {currentPage} · الصفحة {currentPage} من {book.pageCount}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={busy || currentPage <= 1} onClick={() => void move("previous")}><ChevronRight /> السابق</Button>
              <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); const requested = Number(pageInput); if (!Number.isInteger(requested)) { toast.error("أدخل رقم صفحة صالحًا."); return; } void move("jump", clampPage(requested, book.pageCount)); }}>
                <Input className="h-8 w-16 text-center" inputMode="numeric" value={pageInput} onChange={(event) => setPageInput(event.target.value)} aria-label="رقم الصفحة" disabled={busy} />
                <Button type="submit" size="sm" variant="outline" disabled={busy}>انتقال</Button>
              </form>
              {canGoNext ? <Button size="sm" disabled={busy} onClick={() => void move("next")}>التالي <ChevronLeft /></Button> : null}
              {canComplete ? <Button size="sm" disabled={busy} onClick={() => void move("complete")}><Check /> إتمام الختمة</Button> : null}
            </div>
          </section>
          {currentPage === book.pageCount && !canComplete && readThrough < book.pageCount ? <p className="mt-3 text-sm leading-7 text-muted-foreground">لا يمكن إتمام الختمة قبل قراءة الصفحات السابقة بالتتابع.</p> : null}
        </>
      )}
    </main>
  );
}
