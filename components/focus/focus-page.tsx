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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import {
  type FocusCounterDraft,
  getFocusCounterDraft,
  saveFocusCounterDraft,
} from "@/lib/focus-counter-storage";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import { syncPassageRepetitionCount } from "@/lib/firestore/repetitions";
import {
  listTodayRepetitionsForPassages,
  loadActiveFocusPassage,
  type FocusPassageLoadResult,
} from "@/lib/firestore/today";
import { getReachedRepetitionLevel } from "@/lib/repetition-levels";

const SYNC_DELAY_MS = 1500;

type FocusScreenState = "loading" | "ready" | "not-active" | "error";
type SyncStatus = "saved" | "syncing" | "local";
type ReadyFocusPassage = Extract<FocusPassageLoadResult, { kind: "ready" }>;

function isSameSession(
  first: FocusCounterDraft | null,
  second: FocusCounterDraft
) {
  return (
    first !== null &&
    first.userId === second.userId &&
    first.passageId === second.passageId &&
    first.dateKey === second.dateKey
  );
}

function getLevelLabels(count: number, levels: readonly number[]) {
  const level = getReachedRepetitionLevel(count, levels);
  const current = !level.isStarted
    ? "لم يبدأ"
    : level.currentReachedLevel === null
      ? "قيد البداية"
      : `المستوى ${level.currentReachedLevel}`;

  return {
    current,
    next: level.nextLevel ? `التالي: ${level.nextLevel}` : "اكتملت المستويات الحالية",
  };
}

function getSyncStatusLabel(status: SyncStatus) {
  switch (status) {
    case "syncing":
      return "جارٍ المزامنة...";
    case "local":
      return "محفوظ محليًا — بانتظار المزامنة";
    default:
      return "تم الحفظ";
  }
}

function FocusMessage({
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
            href="/"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            العودة إلى اليوم
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

export function FocusPage({ passageId }: { passageId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [dateKey, setDateKey] = React.useState<string | null>(null);
  const [screenState, setScreenState] = React.useState<FocusScreenState>("loading");
  const [focusPassage, setFocusPassage] = React.useState<ReadyFocusPassage | null>(
    null
  );
  const [counter, setCounter] = React.useState<FocusCounterDraft | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("saved");
  const [isManualDialogOpen, setIsManualDialogOpen] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [isLeaving, setIsLeaving] = React.useState(false);
  const counterRef = React.useRef<FocusCounterDraft | null>(null);
  const focusPassageRef = React.useRef<ReadyFocusPassage | null>(null);
  const syncInFlightRef = React.useRef(false);
  const syncRequestedWhileInFlightRef = React.useRef(false);
  const syncTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(
    null
  );
  const syncNowRef = React.useRef<() => Promise<void>>(async () => undefined);
  const loadRequestRef = React.useRef(0);

  React.useEffect(() => {
    setDateKey(getLocalDateKey());
  }, []);

  const scheduleSync = React.useCallback((delay = SYNC_DELAY_MS) => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void syncNowRef.current();
    }, delay);
  }, []);

  const syncNow = React.useCallback(async () => {
    const session = counterRef.current;
    const passage = focusPassageRef.current;

    if (!session || !passage || !session.dirty) {
      return;
    }

    if (syncInFlightRef.current) {
      syncRequestedWhileInFlightRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    setSyncStatus("syncing");
    const targetCount = session.count;
    let didSucceed = false;

    try {
      await syncPassageRepetitionCount({
        userId: session.userId,
        passageId: session.passageId,
        matnId: session.matnId,
        dateKey: session.dateKey,
        targetCount,
        repetitionLevels: passage.repetitionLevels,
      });
      didSucceed = true;

      const current = counterRef.current;

      if (isSameSession(current, session)) {
        const settled = {
          ...current,
          syncedCount: targetCount,
          dirty: current.count !== targetCount,
          updatedAt: new Date().toISOString(),
        };

        counterRef.current = settled;
        saveFocusCounterDraft(settled);
        setCounter(settled);
        setSyncStatus(settled.dirty ? "local" : "saved");
      }
    } catch (error) {
      const current = counterRef.current;

      if (isSameSession(current, session)) {
        const pending = {
          ...current,
          dirty: true,
          updatedAt: new Date().toISOString(),
        };

        counterRef.current = pending;
        saveFocusCounterDraft(pending);
        setCounter(pending);
        setSyncStatus("local");

        if (process.env.NODE_ENV === "development") {
          console.error("Unable to synchronize the Focus counter.", error);
        }

        toast.error(getFirestoreErrorMessage(error));
      }
    } finally {
      syncInFlightRef.current = false;
      const shouldSyncAgain =
        didSucceed || syncRequestedWhileInFlightRef.current;
      syncRequestedWhileInFlightRef.current = false;

      if (shouldSyncAgain && counterRef.current?.dirty) {
        scheduleSync(didSucceed ? 0 : SYNC_DELAY_MS);
      }
    }
  }, [scheduleSync]);

  syncNowRef.current = syncNow;

  const loadFocus = React.useCallback(async () => {
    const userId = user?.uid;

    if (!userId || !dateKey) {
      return;
    }

    const requestId = ++loadRequestRef.current;
    setScreenState("loading");
    setFocusPassage(null);
    focusPassageRef.current = null;
    setCounter(null);
    counterRef.current = null;

    try {
      const resolvedPassage = await loadActiveFocusPassage(userId, passageId);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      if (resolvedPassage.kind === "not-active") {
        setScreenState("not-active");
        return;
      }

      if (resolvedPassage.kind === "missing-content") {
        setScreenState("error");
        return;
      }

      const identity = {
        userId,
        passageId,
        matnId: resolvedPassage.item.matn.id,
        dateKey,
      };
      const storedDraft = getFocusCounterDraft(identity);

      let remoteCount: number;

      try {
        const repetitionCounts = await listTodayRepetitionsForPassages(userId, dateKey, [
          passageId,
        ]);
        remoteCount = repetitionCounts.get(passageId) ?? 0;
      } catch (error) {
        if (!storedDraft?.dirty) {
          throw error;
        }

        remoteCount = storedDraft.syncedCount;
      }

      if (requestId !== loadRequestRef.current) {
        return;
      }

      const initialCounter: FocusCounterDraft = storedDraft?.dirty
        ? storedDraft
        : {
            version: 1,
            ...identity,
            count: remoteCount,
            syncedCount: remoteCount,
            dirty: false,
            updatedAt: new Date().toISOString(),
          };

      focusPassageRef.current = resolvedPassage;
      setFocusPassage(resolvedPassage);
      counterRef.current = initialCounter;
      saveFocusCounterDraft(initialCounter);
      setCounter(initialCounter);
      setSyncStatus(initialCounter.dirty ? "local" : "saved");
      setScreenState("ready");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load the Focus session.", error);
      }

      if (requestId === loadRequestRef.current) {
        setScreenState("error");
      }
    }
  }, [dateKey, passageId, user?.uid]);

  React.useEffect(() => {
    void loadFocus();
  }, [loadFocus]);

  React.useEffect(() => {
    if (screenState !== "ready" || !counter?.dirty) {
      return;
    }

    scheduleSync();

    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [counter?.count, counter?.dirty, scheduleSync, screenState]);

  React.useEffect(() => {
    function syncWhenUseful() {
      void syncNowRef.current();
    }

    function syncWhenHidden() {
      if (document.visibilityState === "hidden") {
        syncWhenUseful();
      }
    }

    window.addEventListener("online", syncWhenUseful);
    document.addEventListener("visibilitychange", syncWhenHidden);

    return () => {
      window.removeEventListener("online", syncWhenUseful);
      document.removeEventListener("visibilitychange", syncWhenHidden);
    };
  }, []);

  React.useEffect(
    () => () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    },
    []
  );

  function moveToNewLocalDay() {
    const nextDateKey = getLocalDateKey();
    const previousSession = counterRef.current;

    if (!previousSession || nextDateKey === previousSession.dateKey) {
      return false;
    }

    if (previousSession.dirty) {
      void syncNowRef.current();
    }

    counterRef.current = null;
    setCounter(null);
    setScreenState("loading");
    setDateKey(nextDateKey);
    toast.message("بدأ يوم جديد، والعداد يبدأ من سجل اليوم الجديد.");
    return true;
  }

  function updateCount(nextCount: number, showMilestone = true) {
    const current = counterRef.current;

    if (!current || moveToNewLocalDay()) {
      return false;
    }

    const safeCount = Math.max(0, Math.floor(nextCount));

    if (safeCount === current.count) {
      return false;
    }

    const levels = focusPassageRef.current?.repetitionLevels ?? [];
    const previousLevel = getReachedRepetitionLevel(current.count, levels);
    const nextLevel = getReachedRepetitionLevel(safeCount, levels);
    const next = {
      ...current,
      count: safeCount,
      dirty: safeCount !== current.syncedCount,
      updatedAt: new Date().toISOString(),
    };

    counterRef.current = next;
    saveFocusCounterDraft(next);
    setCounter(next);
    setSyncStatus(next.dirty ? "local" : "saved");

    if (
      showMilestone &&
      nextLevel.currentReachedLevel !== null &&
      (previousLevel.currentReachedLevel === null ||
        nextLevel.currentReachedLevel > previousLevel.currentReachedLevel)
    ) {
      toast.success(`وصلت إلى ${nextLevel.currentReachedLevel} تكرارًا.`);
    }

    return true;
  }

  function increment() {
    const current = counterRef.current;

    if (current && updateCount(current.count + 1) && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function decrement() {
    const current = counterRef.current;

    if (current) {
      updateCount(current.count - 1, false);
    }
  }

  function reset() {
    updateCount(0, false);
    setIsResetDialogOpen(false);
  }

  function addManualRepetitions(count: number) {
    const current = counterRef.current;

    if (current) {
      updateCount(current.count + count);
    }
  }

  async function leaveFocus() {
    setIsLeaving(true);

    await Promise.race([
      syncNowRef.current(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 800)),
    ]);
    router.push("/");
  }

  if (screenState === "loading" || !user || !dateKey) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          جارٍ تجهيز جلسة التركيز...
        </div>
      </main>
    );
  }

  if (screenState === "not-active") {
    return (
      <FocusMessage
        title="المقطع غير مضاف لليوم"
        description="هذا المقطع غير مضاف إلى اليوم."
      />
    );
  }

  if (screenState === "error" || !focusPassage || !counter) {
    return (
      <FocusMessage
        title="تعذر فتح جلسة التركيز"
        description="تعذر تحميل المقطع أو بيانات تكراره. يرجى المحاولة مرة أخرى."
        retry={() => void loadFocus()}
      />
    );
  }

  const labels = getLevelLabels(counter.count, focusPassage.repetitionLevels);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <h1 className="sr-only">جلسة التركيز</h1>
        <header className="flex w-full items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{focusPassage.item.matn.name}</p>
            {focusPassage.item.contextTitles.length > 0 ? (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {focusPassage.item.contextTitles.join(" · ")}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLeaving}
            onClick={() => void leaveFocus()}
          >
            <ArrowRight className="rtl:rotate-180" />
            العودة لليوم
          </Button>
        </header>

        <p className="mt-12 w-full whitespace-pre-wrap text-center text-xl leading-[2.8rem] text-foreground sm:mt-16 sm:text-2xl sm:leading-[3.2rem]">
          {focusPassage.item.passage.text}
        </p>

        <PassageResources
          passageId={focusPassage.item.passage.id}
          variant="focus"
        />

        <div className="mt-8 sm:mt-10">
          <FocusCounter count={counter.count} disabled={isLeaving} onIncrement={increment} />
        </div>

        <div className="mt-8 grid w-full max-w-md gap-3 text-center sm:grid-cols-2">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">المستوى الحالي</p>
            <p className="mt-1 font-medium text-foreground">{labels.current}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">الهدف التالي</p>
            <p className="mt-1 font-medium text-foreground">{labels.next}</p>
          </div>
        </div>

        <div className="mt-7 flex w-full max-w-md flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={counter.count === 0 || isLeaving}
            onClick={decrement}
          >
            <Minus />
            تصحيح -1
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLeaving}
            onClick={() => setIsManualDialogOpen(true)}
          >
            إضافة تكرارات يدوية
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={counter.count === 0 || isLeaving}
            onClick={() => setIsResetDialogOpen(true)}
          >
            <RotateCcw />
            تصفير
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
          {getSyncStatusLabel(syncStatus)}
        </p>
      </section>

      <ManualRepetitionDialog
        open={isManualDialogOpen}
        onOpenChange={setIsManualDialogOpen}
        onAdd={addManualRepetitions}
      />

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تصفير تكرارات اليوم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تصفير عدد تكرارات هذا المقطع لليوم فقط. لن يُزال المقطع من
              اليوم ولن تتغير تكرارات الأيام السابقة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isLeaving}
              onClick={reset}
            >
              تصفير التكرارات
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
