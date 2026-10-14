"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LearnerError,
  LearnerLoading,
  LearnerPage,
} from "@/components/levels/learner-page";
import { useAuth } from "@/hooks/use-auth";
import { getLocalDateKey } from "@/lib/date-key";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import {
  deferReviewGroups,
  ignoreReviewGroups,
  loadDueReviewSuggestions,
} from "@/lib/firestore/reviews";
import { createReviewFocusHref } from "@/lib/review-focus-route";
import {
  getAdjustedSuggestedReviewUnit,
  type SuggestedReviewUnit,
} from "@/lib/review-grouping";
import {
  addLocalCalendarDays,
  getReviewStageLabel,
  isLocalDateKeyAfter,
} from "@/lib/review-scheduling";

type ReviewState = "loading" | "ready" | "error";
type ReviewData = Awaited<ReturnType<typeof loadDueReviewSuggestions>>;

function getPassageRangeLabel(unit: SuggestedReviewUnit) {
  const itemLabel = unit.matn.type === "POETRY" ? "البيت" : "المقطع";
  const collectionLabel = unit.matn.type === "POETRY" ? "الأبيات" : "المقاطع";

  return unit.startPosition === unit.endPosition
    ? `${itemLabel} ${unit.startPosition}`
    : `${collectionLabel} ${unit.startPosition}–${unit.endPosition}`;
}

function getDueDateLabel(date: Date) {
  const todayKey = getLocalDateKey();
  const dueDateKey = getLocalDateKey(date);

  if (dueDateKey === todayKey) {
    return "مستحقة اليوم";
  }

  const formattedDate = new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "long",
  }).format(date);

  return `موعدها: ${formattedDate}`;
}

function ReviewUnitCard({
  unit,
  isBusy,
  onDefer,
  onIgnore,
}: {
  unit: SuggestedReviewUnit;
  isBusy: boolean;
  onDefer: (unit: SuggestedReviewUnit, dueDateKey: string) => void;
  onIgnore: (unit: SuggestedReviewUnit) => void;
}) {
  const [startSpanIndex, setStartSpanIndex] = React.useState(0);
  const [endSpanIndex, setEndSpanIndex] = React.useState(unit.spans.length - 1);
  const [customDate, setCustomDate] = React.useState("");
  const todayKey = getLocalDateKey();
  const minimumCustomDate = addLocalCalendarDays(todayKey, 1);

  React.useEffect(() => {
    setStartSpanIndex(0);
    setEndSpanIndex(unit.spans.length - 1);
    setCustomDate("");
  }, [unit.id, unit.spans.length]);

  const adjustedUnit = getAdjustedSuggestedReviewUnit(
    unit,
    startSpanIndex,
    endSpanIndex
  );

  function selectStart(nextIndex: number) {
    setStartSpanIndex(nextIndex);
    setEndSpanIndex((current) => Math.max(current, nextIndex));
  }

  function selectEnd(nextIndex: number) {
    setEndSpanIndex(nextIndex);
    setStartSpanIndex((current) => Math.min(current, nextIndex));
  }

  function deferByDays(days: number) {
    onDefer(adjustedUnit, addLocalCalendarDays(getLocalDateKey(), days));
  }

  function deferToCustomDate() {
    if (!customDate || !isLocalDateKeyAfter(customDate, getLocalDateKey())) {
      toast.error("اختر تاريخًا بعد اليوم للتأجيل.");
      return;
    }

    onDefer(adjustedUnit, customDate);
  }

  return (
    <article className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">{unit.matn.name}</h2>
          <Badge variant="secondary">{getReviewStageLabel(unit.reviewStage)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {getPassageRangeLabel(adjustedUnit)} · {getDueDateLabel(adjustedUnit.dueAt)}
        </p>
      </header>

      <div className="space-y-2 border-y py-4">
        {adjustedUnit.passages.slice(0, 3).map(({ passage, position }) => (
          <p
            key={passage.id}
            className="line-clamp-2 whitespace-pre-wrap text-sm leading-7 text-foreground"
          >
            <span className="me-2 text-muted-foreground">{position}.</span>
            {passage.text}
          </p>
        ))}
        {adjustedUnit.passages.length > 3 ? (
          <p className="text-xs text-muted-foreground">
            + {adjustedUnit.passages.length - 3}{" "}
            {unit.matn.type === "POETRY" ? "أبيات أخرى" : "مقاطع أخرى"}
          </p>
        ) : null}
      </div>

      {unit.spans.length > 1 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            <span>من</span>
            <select
              value={startSpanIndex}
              onChange={(event) => selectStart(Number(event.target.value))}
              disabled={isBusy}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {unit.spans.map((span, index) => (
                <option key={span.sourceReviewGroupId} value={index}>
                  {unit.matn.type === "POETRY" ? "البيت" : "المقطع"} {span.startPosition}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            <span>إلى</span>
            <select
              value={endSpanIndex}
              onChange={(event) => selectEnd(Number(event.target.value))}
              disabled={isBusy}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {unit.spans.map((span, index) => (
                <option
                  key={span.sourceReviewGroupId}
                  value={index}
                  disabled={index < startSpanIndex}
                >
                  {unit.matn.type === "POETRY" ? "البيت" : "المقطع"} {span.endPosition}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">تأجيل</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => deferByDays(1)}>
            يوم
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => deferByDays(3)}>
            3 أيام
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => deferByDays(7)}>
            أسبوع
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customDate}
            min={minimumCustomDate}
            disabled={isBusy}
            onChange={(event) => setCustomDate(event.target.value)}
            className="w-auto min-w-44"
            aria-label="تاريخ تأجيل مخصص"
          />
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={deferToCustomDate}>
            تاريخ مخصص
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Link
          href={createReviewFocusHref({
            matnId: adjustedUnit.matnId,
            reviewStage: adjustedUnit.reviewStage,
            sourceReviewGroupIds: adjustedUnit.sourceReviewGroupIds,
            sourceReviewGroupDueAts: adjustedUnit.spans.map((span) =>
              span.dueAt.toISOString()
            ),
            passageIds: adjustedUnit.passageIds,
          })}
          aria-disabled={isBusy || undefined}
          tabIndex={isBusy ? -1 : undefined}
          className={`${buttonVariants({ size: "sm" })} ${
            isBusy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          بدء المراجعة
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isBusy}
          className="text-destructive hover:text-destructive"
          onClick={() => onIgnore(adjustedUnit)}
        >
          تجاهل المراجعة
        </Button>
      </div>
    </article>
  );
}

function groupUnitsByMatn(units: readonly SuggestedReviewUnit[]) {
  const groups = new Map<string, { matnName: string; units: SuggestedReviewUnit[] }>();

  for (const unit of units) {
    const existing = groups.get(unit.matnId);

    if (existing) {
      existing.units.push(unit);
    } else {
      groups.set(unit.matnId, { matnName: unit.matn.name, units: [unit] });
    }
  }

  return [...groups.values()];
}

export function ReviewPage() {
  const { user } = useAuth();
  const [state, setState] = React.useState<ReviewState>("loading");
  const [reviewData, setReviewData] = React.useState<ReviewData | null>(null);
  const [busyReviewGroupIds, setBusyReviewGroupIds] = React.useState<Set<string>>(
    new Set()
  );
  const [unitToIgnore, setUnitToIgnore] = React.useState<SuggestedReviewUnit | null>(null);
  const requestRef = React.useRef(0);

  const loadReviews = React.useCallback(async () => {
    const userId = user?.uid;

    if (!userId) {
      return;
    }

    const requestId = ++requestRef.current;
    setState("loading");
    setReviewData(null);

    try {
      const nextReviewData = await loadDueReviewSuggestions(userId);

      if (requestId !== requestRef.current) {
        return;
      }

      if (nextReviewData.invalidReviewGroupIds.length > 0 && process.env.NODE_ENV === "development") {
        console.warn("Some due review groups reference unavailable scientific content.", nextReviewData.invalidReviewGroupIds);
      }

      setReviewData(nextReviewData);
      setState("ready");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load due reviews.", error);
      }

      if (requestId === requestRef.current) {
        setState("error");
      }
    }
  }, [user?.uid]);

  React.useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function deferUnit(unit: SuggestedReviewUnit, dueDateKey: string) {
    if (unit.sourceReviewGroupIds.some((groupId) => busyReviewGroupIds.has(groupId))) {
      return;
    }

    setBusyReviewGroupIds((current) =>
      new Set([...current, ...unit.sourceReviewGroupIds])
    );

    try {
      await deferReviewGroups(unit.sourceReviewGroupIds, dueDateKey);
      toast.success("تم تأجيل المراجعة");
      await loadReviews();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to defer the review.", error);
      }

      toast.error(getFirestoreErrorMessage(error));
    } finally {
      setBusyReviewGroupIds((current) => {
        const next = new Set(current);
        unit.sourceReviewGroupIds.forEach((groupId) => next.delete(groupId));
        return next;
      });
    }
  }

  async function ignoreUnit(unit: SuggestedReviewUnit) {
    if (unit.sourceReviewGroupIds.some((groupId) => busyReviewGroupIds.has(groupId))) {
      return;
    }

    setBusyReviewGroupIds((current) =>
      new Set([...current, ...unit.sourceReviewGroupIds])
    );

    try {
      await ignoreReviewGroups(unit.sourceReviewGroupIds);
      toast.success("تم تجاهل المراجعة");
      setUnitToIgnore(null);
      await loadReviews();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to ignore the review.", error);
      }

      toast.error(getFirestoreErrorMessage(error));
    } finally {
      setBusyReviewGroupIds((current) => {
        const next = new Set(current);
        unit.sourceReviewGroupIds.forEach((groupId) => next.delete(groupId));
        return next;
      });
    }
  }

  const unitsByMatn = reviewData ? groupUnitsByMatn(reviewData.units) : [];

  return (
    <LearnerPage title="المراجعة" description="المراجعات التي حان وقتها بحسب خطة الحفظ.">
      {state === "loading" || !user ? <LearnerLoading label="جارٍ تحميل المراجعات المستحقة..." /> : null}
      {state === "error" ? <LearnerError onRetry={() => void loadReviews()} /> : null}
      {state === "ready" && reviewData ? (
        reviewData.units.length === 0 ? (
          <section className="space-y-3 rounded-xl border border-dashed px-5 py-8 sm:px-6">
            <CalendarClock className="size-5 text-muted-foreground" />
            <h2 className="font-medium text-foreground">المراجعات المستحقة</h2>
            <p className="text-sm leading-7 text-muted-foreground">لا توجد مراجعات مستحقة اليوم.</p>
          </section>
        ) : (
          <section className="mx-auto max-w-4xl space-y-8" aria-label="المراجعات المستحقة">
            <header>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">المراجعات المستحقة</h2>
            </header>
            {unitsByMatn.map(({ matnName, units }) => (
              <section key={units[0].matnId} className="space-y-4">
                <h3 className="px-1 font-medium text-muted-foreground">{matnName}</h3>
                <div className="space-y-4">
                  {units.map((unit) => (
                    <ReviewUnitCard
                      key={unit.id}
                      unit={unit}
                      isBusy={unit.sourceReviewGroupIds.some((groupId) =>
                        busyReviewGroupIds.has(groupId)
                      )}
                      onDefer={deferUnit}
                      onIgnore={setUnitToIgnore}
                    />
                  ))}
                </div>
              </section>
            ))}
          </section>
        )
      ) : null}

      <AlertDialog
        open={Boolean(unitToIgnore)}
        onOpenChange={(open) => {
          if (!open) {
            setUnitToIgnore(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تجاهل المراجعة؟</AlertDialogTitle>
            <AlertDialogDescription>
              لن تظهر هذه المراجعة تلقائيًا مرة أخرى. يمكنك إضافة مراجعة يدوية لاحقًا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={
                !unitToIgnore ||
                unitToIgnore.sourceReviewGroupIds.some((groupId) =>
                  busyReviewGroupIds.has(groupId)
                )
              }
              onClick={() => {
                if (unitToIgnore) {
                  void ignoreUnit(unitToIgnore);
                }
              }}
            >
              تجاهل المراجعة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LearnerPage>
  );
}
