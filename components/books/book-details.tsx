"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import { getActiveBookContext, type ActiveBookContext } from "@/lib/firestore/books";
import { getBookReadingSummary, startBookReadingCycle, type BookReadingSummary } from "@/lib/firestore/book-reading";

function formatTimestamp(value: { toDate?: () => Date } | undefined) {
  if (!value?.toDate) return "—";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(value.toDate());
}

export function BookDetails({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [context, setContext] = React.useState<ActiveBookContext | null>(null);
  const [summary, setSummary] = React.useState<BookReadingSummary | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [starting, setStarting] = React.useState(false);

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const nextContext = await getActiveBookContext(bookId);
      if (!nextContext) {
        setContext(null);
        setSummary(null);
        setState("not-found");
        return;
      }
      setContext(nextContext);
      setSummary(user?.uid ? await getBookReadingSummary(user.uid, bookId, getLocalDateKey()) : null);
      setState("ready");
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("Unable to load book details.", error);
      setState("error");
    }
  }, [bookId, user?.uid]);

  React.useEffect(() => { void load(); }, [load]);

  async function startOrContinue() {
    if (!user?.uid || !context) return;
    if (!context.book.pageCount) {
      toast.error("لا توجد صفحات قابلة للقراءة في هذا الكتاب بعد.");
      return;
    }
    setStarting(true);
    try {
      await startBookReadingCycle(user.uid, context.book.id, context.book.pageCount);
      router.push(`/books/${context.book.id}/read`);
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("Unable to start book cycle.", error);
      toast.error("تعذر بدء الختمة الآن.");
    } finally { setStarting(false); }
  }

  if (state === "loading") return <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">جارٍ تحميل الكتاب...</main>;
  if (state === "not-found") return <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">هذا الكتاب غير متاح.</main>;
  if (state === "error") return <main className="mx-auto max-w-4xl px-4 py-10"><p className="text-sm text-muted-foreground">تعذر تحميل الكتاب.</p><Button className="mt-3" size="sm" onClick={() => void load()}>إعادة المحاولة</Button></main>;
  if (!context) return null;

  const { book } = context;
  const current = summary?.currentCycle;
  const progress = current && book.pageCount ? Math.round((current.readThroughPage / book.pageCount) * 100) : 0;
  const cta = current ? "متابعة القراءة" : summary?.completedCyclesCount ? "بدء ختمة جديدة" : "بدء القراءة";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title={book.title} description={book.description ?? "تفاصيل الكتاب وختمات القراءة."} />
      <Link href="/books" className="mt-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4 rtl:rotate-180" /> قراءة الكتب</Link>
      <article className="mt-4 rounded-xl border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">{book.author ? <p className="text-muted-foreground">{book.author}</p> : null}</div>
          <Badge variant="secondary">{book.type === "PDF" ? "PDF" : "نصي"}</Badge>
        </div>
        <dl className="mt-7 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">عدد الصفحات</dt><dd className="mt-1 font-medium">{book.pageCount}</dd></div>
          <div><dt className="text-muted-foreground">الختمات المكتملة</dt><dd className="mt-1 font-medium">{summary?.completedCyclesCount ?? 0}</dd></div>
          <div><dt className="text-muted-foreground">الختمة الحالية</dt><dd className="mt-1 font-medium">{current ? `الختمة ${current.cycleNumber} · ${current.readThroughPage} من ${book.pageCount} · ${progress}%` : "لا توجد ختمة جارية"}</dd></div>
          <div><dt className="text-muted-foreground">الصفحات المقروءة اليوم</dt><dd className="mt-1 font-medium">{summary?.pagesReadToday ?? 0}</dd></div>
          <div><dt className="text-muted-foreground">آخر قراءة</dt><dd className="mt-1 font-medium">{formatTimestamp(current?.lastReadAt)}</dd></div>
        </dl>
        <Button className="mt-8" disabled={starting || book.pageCount === 0} onClick={() => void startOrContinue()}>
          <BookOpen /> {starting ? "جارٍ الفتح..." : cta}
        </Button>
      </article>
    </main>
  );
}
