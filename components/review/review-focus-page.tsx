"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Minus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { FocusCounter } from "@/components/focus/focus-counter";
import { ManualRepetitionDialog } from "@/components/focus/manual-repetition-dialog";
import { PassageResources } from "@/components/passage-resources";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import {
  completeReviewFocus,
  loadReviewFocusSession,
  ReviewFocusValidationError,
  type ReviewFocusSession,
} from "@/lib/firestore/review-focus";
import type { ReviewFocusRouteRequest } from "@/lib/review-focus-route";
import { getReachedRepetitionLevel } from "@/lib/repetition-levels";
import { getFirstReviewThreshold, getReviewStageLabel } from "@/lib/review-scheduling";

type ReviewFocusScreenState = "loading" | "ready" | "invalid" | "error";

function ReviewFocusMessage({
  title,
  description,
  retry,
}: {
  title: string;
  description: string;
  retry?: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/review"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            العودة إلى المراجعة
          </Link>
          {retry ? (
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              إعادة المحاولة
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function ReviewFocusPage({
  request,
}: {
  request: ReviewFocusRouteRequest | null;
}) {
  const { loading: isAuthLoading, user } = useAuth();
  const router = useRouter();
  const [screenState, setScreenState] = React.useState<ReviewFocusScreenState>(
    "loading"
  );
  const [session, setSession] = React.useState<ReviewFocusSession | null>(null);
  const [count, setCount] = React.useState(0);
  const [isManualDialogOpen, setIsManualDialogOpen] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const loadRequestRef = React.useRef(0);
  const isCompletingRef = React.useRef(false);
  const countRef = React.useRef(0);

  const loadSession = React.useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!user || !request) {
      setSession(null);
      setScreenState("invalid");
      return;
    }

    const requestId = ++loadRequestRef.current;
    setScreenState("loading");
    setSession(null);
    countRef.current = 0;
    setCount(0);

    try {
      const nextSession = await loadReviewFocusSession(user.uid, request);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      setSession(nextSession);
      countRef.current = 0;
      setCount(0);
      setScreenState("ready");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load the review focus session.", error);
      }

      if (requestId === loadRequestRef.current) {
        setScreenState(
          error instanceof ReviewFocusValidationError ? "invalid" : "error"
        );
      }
    }
  }, [isAuthLoading, request, user]);

  React.useEffect(() => {
    void loadSession();
  }, [loadSession]);

  function updateCount(nextCount: number, showMilestone = true) {
    if (!session || isCompleting) {
      return;
    }

    const currentCount = countRef.current;
    const safeCount = Math.max(0, Math.floor(nextCount));

    if (safeCount === currentCount) {
      return;
    }

    const previousLevel = getReachedRepetitionLevel(
      currentCount,
      session.repetitionLevels
    );
    const nextLevel = getReachedRepetitionLevel(safeCount, session.repetitionLevels);
    countRef.current = safeCount;
    setCount(safeCount);

    if (
      showMilestone &&
      nextLevel.currentReachedLevel !== null &&
      (previousLevel.currentReachedLevel === null ||
        nextLevel.currentReachedLevel > previousLevel.currentReachedLevel)
    ) {
      toast.success(`وصلت إلى ${nextLevel.currentReachedLevel} تكرارًا.`);
    }
  }

  function increment() {
    updateCount(countRef.current + 1);

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function decrement() {
    updateCount(countRef.current - 1, false);
  }

  async function complete() {
    if (
      !user ||
      !request ||
      !session ||
      countRef.current < getFirstReviewThreshold(session.repetitionLevels) ||
      isCompletingRef.current
    ) {
      return;
    }

    isCompletingRef.current = true;
    setIsCompleting(true);
    let didComplete = false;

    try {
      await completeReviewFocus({
        userId: user.uid,
        request,
        repetitionCount: countRef.current,
        completedDateKey: getLocalDateKey(),
      });
      didComplete = true;
      toast.success("تمت المراجعة بنجاح");
      router.replace("/review");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to complete the review.", error);
      }

      toast.error(
        error instanceof ReviewFocusValidationError
          ? "تعذر إتمام المراجعة لأن جدولها تغيّر. عد إلى صفحة المراجعة وحاول مجددًا."
          : getFirestoreErrorMessage(error)
      );
    } finally {
      if (!didComplete) {
        isCompletingRef.current = false;
        setIsCompleting(false);
      }
    }
  }

  if (screenState === "loading" || isAuthLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          جارٍ تجهيز جلسة المراجعة...
        </div>
      </main>
    );
  }

  if (screenState === "invalid") {
    return (
      <ReviewFocusMessage
        title="جلسة المراجعة غير متاحة"
        description="قد تكون المراجعة قد تغيّرت أو لم تعد مستحقة. عد إلى صفحة المراجعة واخترها من جديد."
      />
    );
  }

  if (screenState === "error" || !session) {
    return (
      <ReviewFocusMessage
        title="تعذر فتح جلسة المراجعة"
        description="تعذر تحميل بيانات المراجعة. يرجى المحاولة مرة أخرى."
        retry={() => void loadSession()}
      />
    );
  }

  const itemLabel = session.matn.type === "POETRY" ? "البيت" : "المقطع";
  const collectionLabel = session.matn.type === "POETRY" ? "الأبيات" : "المقاطع";
  const completionThreshold = getFirstReviewThreshold(session.repetitionLevels);
  const canComplete = count >= completionThreshold;

  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <header className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="truncate font-medium text-foreground">{session.matn.name}</p>
            <Badge variant="secondary">{getReviewStageLabel(session.reviewStage)}</Badge>
            <p className="text-sm text-muted-foreground">
              {session.passages.length} {collectionLabel} في مراجعة واحدة
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isCompleting}
            onClick={() => router.push("/review")}
          >
            <ArrowRight className="rtl:rotate-180" />
            العودة
          </Button>
        </header>

        <section className="mt-8 w-full space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-label="مقاطع المراجعة">
          <h1 className="font-semibold text-foreground">جلسة مراجعة</h1>
          <ol className="divide-y">
            {session.passages.map(({ passage, position }) => (
              <li key={passage.id} className="py-4 first:pt-0 last:pb-0">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {itemLabel} {position}
                </p>
                <p className="whitespace-pre-wrap text-base leading-8 text-foreground">
                  {passage.text}
                </p>
                <PassageResources passageId={passage.id} variant="focus" />
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 flex w-full flex-col items-center" aria-label="عداد المراجعة">
          <FocusCounter
            count={count}
            disabled={isCompleting}
            onIncrement={increment}
            incrementLabel="+1"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            حد إتمام المراجعة: {completionThreshold} تكرارات
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isCompleting || count === 0}
              onClick={decrement}
            >
              <Minus />
              إنقاص
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isCompleting}
              onClick={() => setIsManualDialogOpen(true)}
            >
              إضافة يدويًا
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isCompleting || count === 0}
              onClick={() => setIsResetDialogOpen(true)}
            >
              <RotateCcw />
              تصفير
            </Button>
          </div>

          {canComplete ? (
            <p className="mt-6 text-sm font-medium text-primary">
              اكتملت المراجعة من حيث التكرار. يمكنك الآن إتمامها.
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="mt-4"
            disabled={!canComplete || isCompleting}
            onClick={() => void complete()}
          >
            {isCompleting ? <LoaderCircle className="animate-spin" /> : null}
            إتمام المراجعة
          </Button>
        </section>
      </section>

      <ManualRepetitionDialog
        open={isManualDialogOpen}
        onOpenChange={setIsManualDialogOpen}
        onAdd={(manualCount) => updateCount(countRef.current + manualCount)}
        description="أضف التكرارات التي أجريتها خارج التطبيق إلى عداد هذه المراجعة فقط."
      />

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تصفير عداد المراجعة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُصفّر عداد هذه الجلسة فقط، ولن يتغير أي سجل محفوظ في التطبيق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => {
                updateCount(0, false);
                setIsResetDialogOpen(false);
              }}
            >
              تصفير العداد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
