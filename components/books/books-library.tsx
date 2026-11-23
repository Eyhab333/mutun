"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import {
  type BookLibraryLevel,
  listActiveBookLibrary,
} from "@/lib/firestore/books";
import { getBookReadingSummary, type BookReadingSummary } from "@/lib/firestore/book-reading";
import type { Book } from "@/types";

type SummaryMap = Record<string, BookReadingSummary>;

function BookSummary({ book, summary }: { book: Book; summary?: BookReadingSummary }) {
  const currentCycle = summary?.currentCycle;
  const progress = currentCycle
    ? `${currentCycle.readThroughPage} من ${book.pageCount}`
    : summary?.completedCyclesCount
      ? `${summary.completedCyclesCount} ختمات مكتملة`
      : "لم تبدأ القراءة بعد";
  const action = currentCycle
    ? "متابعة القراءة"
    : summary?.completedCyclesCount
      ? "بدء ختمة جديدة"
      : "بدء القراءة";

  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-foreground">{book.title}</h3>
          {book.author ? <p className="text-sm text-muted-foreground">{book.author}</p> : null}
        </div>
        <Badge variant="secondary" className="shrink-0">
          {book.type === "PDF" ? "PDF" : "نصي"}
        </Badge>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {book.pageCount ? `${book.pageCount} صفحة` : "لم تُضف صفحات الكتاب بعد"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {currentCycle ? `الختمة ${currentCycle.cycleNumber} · ${progress}` : progress}
      </p>
      {book.pageCount > 0 ? (
        <Button className="mt-4" size="sm" render={<Link href={`/books/${book.id}`} />}>
          <BookOpen />
          {action}
        </Button>
      ) : (
        <Button className="mt-4" size="sm" disabled>
          <BookOpen />
          لا توجد صفحات بعد
        </Button>
      )}
    </article>
  );
}

function ToggleBranch({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className="border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-3 text-start text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4 rtl:rotate-180" />}
        <span>{label}</span>
      </button>
      {open ? <div className="space-y-3 border-t bg-muted/20 p-3">{children}</div> : null}
    </section>
  );
}

export function BooksLibrary() {
  const { user } = useAuth();
  const [library, setLibrary] = React.useState<BookLibraryLevel[]>([]);
  const [summaries, setSummaries] = React.useState<SummaryMap>({});
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const nextLibrary = await listActiveBookLibrary();
      setLibrary(nextLibrary);
      const books = nextLibrary.flatMap((level) =>
        level.sciences.flatMap((science) => [
          ...science.directBooks,
          ...science.collections.flatMap((collection) => collection.books),
        ])
      );
      if (user?.uid) {
        const values = await Promise.all(
          books.map(async (book) => [
            book.id,
            await getBookReadingSummary(user.uid, book.id, getLocalDateKey()),
          ] as const)
        );
        setSummaries(Object.fromEntries(values));
      } else {
        setSummaries({});
      }
      setState("ready");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load the books library.", error);
      }
      setState("error");
    }
  }, [user?.uid]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader title="قراءة الكتب" description="اختر كتابًا واقرأه ضمن ختمات متتابعة بهدوء." />

      <div className="mt-8 overflow-hidden rounded-xl border bg-card">
        {state === "loading" ? <p className="p-5 text-sm text-muted-foreground">جارٍ تحميل الكتب...</p> : null}
        {state === "error" ? (
          <div className="space-y-3 p-5 text-sm text-muted-foreground">
            <p>تعذر تحميل الكتب.</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>إعادة المحاولة</Button>
          </div>
        ) : null}
        {state === "ready" && library.length === 0 ? (
          <p className="p-5 text-sm leading-7 text-muted-foreground">لا توجد كتب متاحة حاليًا.</p>
        ) : null}
        {state === "ready" ? library.map((level) => (
          <ToggleBranch key={level.level.id} label={level.level.name}>
            {level.sciences.map((science) => (
              <ToggleBranch key={science.science.id} label={science.science.name}>
                {science.directBooks.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {science.directBooks.map((book) => <BookSummary key={book.id} book={book} summary={summaries[book.id]} />)}
                  </div>
                ) : null}
                {science.collections.map((collection) => (
                  <ToggleBranch key={collection.collection.id} label={collection.collection.title}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {collection.books.map((book) => <BookSummary key={book.id} book={book} summary={summaries[book.id]} />)}
                    </div>
                  </ToggleBranch>
                ))}
              </ToggleBranch>
            ))}
          </ToggleBranch>
        )) : null}
      </div>
    </section>
  );
}
