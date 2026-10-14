"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowBigRightDashIcon } from "lucide-react";
import { toast } from "sonner";

import {
  LearnerError,
  LearnerLoading,
  LearnerPage,
} from "@/components/levels/learner-page";
import { WeakPassageButton } from "@/components/weak-passage-button";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import {
  loadTodayLearningQueue,
  type TodayLearningQueue,
  type TodayPassageItem,
} from "@/lib/firestore/today";
import { removePassageFromToday } from "@/lib/firestore/user-active-passages";
import { listWeakPassageStates } from "@/lib/firestore/user-passage-states";
import { getReachedRepetitionLevel } from "@/lib/repetition-levels";

function getCurrentLevelLabel(
  repetitionCount: number,
  repetitionLevels: readonly number[]
) {
  const level = getReachedRepetitionLevel(repetitionCount, repetitionLevels);

  if (!level.isStarted) {
    return "لم يبدأ";
  }

  return level.currentReachedLevel === null
    ? "قيد البداية"
    : `المستوى ${level.currentReachedLevel}`;
}

function TodayPassageCard({
  item,
  repetitionLevels,
  isRemoving,
  isWeak,
  isWeakStateReady,
  onRemove,
  onWeakChange,
}: {
  item: TodayPassageItem;
  repetitionLevels: readonly number[];
  isRemoving: boolean;
  isWeak: boolean;
  isWeakStateReady: boolean;
  onRemove: (item: TodayPassageItem) => void;
  onWeakChange: (passageId: string, isWeak: boolean) => void;
}) {
  return (
    <article className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-foreground">{item.matn.name}</h2>
        {item.contextTitles.length > 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {item.contextTitles.join(" · ")}
          </p>
        ) : null}
      </header>

      <p className="whitespace-pre-wrap text-base leading-9 text-foreground sm:text-lg sm:leading-10">
        {item.passage.text}
      </p>

      <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-muted/45 px-3 py-2.5">
          <p className="text-muted-foreground">تكرار اليوم</p>
          <p className="mt-1 font-medium text-foreground">{item.repetitionCount}</p>
        </div>
        <div className="rounded-lg bg-muted/45 px-3 py-2.5">
          <p className="text-muted-foreground">المستوى الحالي</p>
          <p className="mt-1 font-medium text-foreground">
            {getCurrentLevelLabel(item.repetitionCount, repetitionLevels)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/focus/${item.passage.id}`}
            className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            بدء التركيز
          </Link>
          {isWeakStateReady ? (
            <WeakPassageButton
              userId={item.activePassage.userId}
              passage={item.passage}
              isWeak={isWeak}
              onWeakChange={onWeakChange}
            />
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRemoving}
          onClick={() => onRemove(item)}
        >
          <ArrowBigRightDashIcon />
          تم ويرحل الى المراجعة
        </Button>
      </div>
    </article>
  );
}

export function TodayPage() {
  const { user } = useAuth();
  const [dateKey, setDateKey] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [queue, setQueue] = React.useState<TodayLearningQueue | null>(null);
  const [removingPassageIds, setRemovingPassageIds] = React.useState<Set<string>>(
    new Set()
  );
  const [weakPassageIds, setWeakPassageIds] = React.useState<Set<string>>(
    new Set()
  );
  const [weakState, setWeakState] = React.useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    setDateKey(getLocalDateKey());
  }, []);

  const loadToday = React.useCallback(async () => {
    const userId = user?.uid;

    if (!userId || !dateKey) {
      return;
    }

    const requestId = ++requestRef.current;
    setState("loading");
    setQueue(null);

    try {
      const weakStatesRequest = listWeakPassageStates(userId)
        .then((states) => ({ states, isAvailable: true }))
        .catch((error) => {
          if (process.env.NODE_ENV === "development") {
            console.error("Unable to load passage weakness states for Today.", error);
          }

          return { states: [], isAvailable: false };
        });
      const [nextQueue, weakStates] = await Promise.all([
        loadTodayLearningQueue(userId, dateKey),
        weakStatesRequest,
      ]);

      if (requestId === requestRef.current) {
        setQueue(nextQueue);
        setWeakPassageIds(new Set(weakStates.states.map((state) => state.passageId)));
        setWeakState(weakStates.isAvailable ? "ready" : "unavailable");
        setState("ready");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load Today learning queue.", error);
      }

      if (requestId === requestRef.current) {
        setState("error");
      }
    }
  }, [dateKey, user?.uid]);

  React.useEffect(() => {
    void loadToday();
  }, [loadToday]);

  async function removeFromToday(item: TodayPassageItem) {
    const userId = user?.uid;

    if (!userId || removingPassageIds.has(item.passage.id)) {
      return;
    }

    setRemovingPassageIds((current) => new Set(current).add(item.passage.id));

    try {
      await removePassageFromToday(userId, item.passage.id);
      setQueue((current) =>
        current
          ? {
              ...current,
              items: current.items.filter(
                (queueItem) => queueItem.passage.id !== item.passage.id
              ),
            }
          : current
      );
      toast.success("تمت إزالة المقطع من اليوم.");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to remove passage from Today.", error);
      }

      toast.error(getFirestoreErrorMessage(error));
    } finally {
      setRemovingPassageIds((current) => {
        const next = new Set(current);
        next.delete(item.passage.id);
        return next;
      });
    }
  }

  function updatePassageWeakState(passageId: string, isWeak: boolean) {
    setWeakPassageIds((current) => {
      const next = new Set(current);

      if (isWeak) {
        next.add(passageId);
      } else {
        next.delete(passageId);
      }

      return next;
    });
  }

  return (
    <LearnerPage
      title="اليوم"
      description="المقاطع التي تعمل عليها الآن."
    >
      {state === "loading" || !user || !dateKey ? (
        <LearnerLoading label="جارٍ تحميل مقاطع اليوم..." />
      ) : null}

      {state === "error" ? <LearnerError onRetry={() => void loadToday()} /> : null}

      {state === "ready" && queue ? (
        queue.items.length === 0 ? (
          <div className="space-y-4 rounded-xl border border-dashed px-5 py-8 sm:px-6">
            <p className="text-sm leading-7 text-muted-foreground">
              لا توجد مقاطع مضافة لليوم بعد.
            </p>
            <Link
              href="/levels"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              تصفح المتون
            </Link>
          </div>
        ) : (
          <section aria-label="مقاطع اليوم" className="mx-auto max-w-4xl space-y-4">
            {queue.items.map((item) => (
              <TodayPassageCard
                key={item.activePassage.id}
                item={item}
                repetitionLevels={queue.repetitionLevels}
                isRemoving={removingPassageIds.has(item.passage.id)}
                isWeak={weakPassageIds.has(item.passage.id)}
                isWeakStateReady={weakState === "ready"}
                onRemove={removeFromToday}
                onWeakChange={updatePassageWeakState}
              />
            ))}
          </section>
        )
      ) : null}
    </LearnerPage>
  );
}
