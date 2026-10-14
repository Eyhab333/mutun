"use client";

import * as React from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  LearnerError,
  LearnerLoading,
  LearnerPage,
} from "@/components/levels/learner-page";
import { useAuth } from "@/hooks/use-auth";
import {
  loadRepairSuggestions as getRepairSuggestions,
  type SuggestedRepairUnit,
} from "@/lib/firestore/repair";
import { createRepairFocusHref } from "@/lib/repair-focus-route";
import { getAdjustedRepairUnit } from "@/lib/repair-grouping";

type RepairPageState = "loading" | "ready" | "error";
type RepairData = Awaited<ReturnType<typeof getRepairSuggestions>>;

function getPassageRangeLabel(unit: SuggestedRepairUnit) {
  const itemLabel = unit.matn.type === "POETRY" ? "البيت" : "المقطع";
  const collectionLabel = unit.matn.type === "POETRY" ? "الأبيات" : "المقاطع";

  return unit.startPosition === unit.endPosition
    ? `${itemLabel} ${unit.startPosition}`
    : `${collectionLabel} ${unit.startPosition}–${unit.endPosition}`;
}

function RepairUnitCard({ unit }: { unit: SuggestedRepairUnit }) {
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(unit.passages.length - 1);

  React.useEffect(() => {
    setStartIndex(0);
    setEndIndex(unit.passages.length - 1);
  }, [unit.id, unit.passages.length]);

  const adjustedUnit = getAdjustedRepairUnit(unit, startIndex, endIndex);
  const itemLabel = unit.matn.type === "POETRY" ? "البيت" : "المقطع";

  function selectStart(nextIndex: number) {
    setStartIndex(nextIndex);
    setEndIndex((current) => Math.max(current, nextIndex));
  }

  function selectEnd(nextIndex: number) {
    setEndIndex(nextIndex);
    setStartIndex((current) => Math.min(current, nextIndex));
  }

  return (
    <article className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
      <div className="space-y-2">
        <p className="font-medium text-foreground">{getPassageRangeLabel(adjustedUnit)}</p>
        <div className="space-y-1.5 border-y py-3">
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
              + {adjustedUnit.passages.length - 3} {unit.matn.type === "POETRY" ? "أبيات أخرى" : "مقاطع أخرى"}
            </p>
          ) : null}
        </div>
      </div>

      {unit.passages.length > 1 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            <span>من</span>
            <select
              value={startIndex}
              onChange={(event) => selectStart(Number(event.target.value))}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {unit.passages.map(({ position }, index) => (
                <option key={position} value={index} disabled={index > endIndex}>
                  {itemLabel} {position}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            <span>إلى</span>
            <select
              value={endIndex}
              onChange={(event) => selectEnd(Number(event.target.value))}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {unit.passages.map(({ position }, index) => (
                <option key={position} value={index} disabled={index < startIndex}>
                  {itemLabel} {position}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end border-t pt-4">
        <Link
          href={createRepairFocusHref({
            matnId: adjustedUnit.matnId,
            passageIds: adjustedUnit.passageIds,
          })}
          className={buttonVariants({ size: "sm" })}
        >
          بدء الترميم
        </Link>
      </div>
    </article>
  );
}

function groupUnitsByMatn(units: readonly SuggestedRepairUnit[]) {
  const groups = new Map<
    string,
    { matnName: string; units: SuggestedRepairUnit[] }
  >();

  for (const unit of units) {
    const existing = groups.get(unit.matnId);

    if (existing) {
      existing.units.push(unit);
    } else {
      groups.set(unit.matnId, {
        matnName: unit.matn.name,
        units: [unit],
      });
    }
  }

  return [...groups.values()];
}

export function RepairPage() {
  const { user } = useAuth();
  const [state, setState] = React.useState<RepairPageState>("loading");
  const [units, setUnits] = React.useState<RepairData>([]);
  const requestRef = React.useRef(0);

  const loadRepairSuggestions = React.useCallback(async () => {
    const userId = user?.uid;

    if (!userId) {
      return;
    }

    const requestId = ++requestRef.current;
    setState("loading");

    try {
      const nextUnits = await getRepairSuggestions(userId);

      if (requestId === requestRef.current) {
        setUnits(nextUnits);
        setState("ready");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load repair suggestions.", error);
      }

      if (requestId === requestRef.current) {
        setState("error");
      }
    }
  }, [user?.uid]);

  React.useEffect(() => {
    void loadRepairSuggestions();
  }, [loadRepairSuggestions]);

  const unitsByMatn = groupUnitsByMatn(units);

  return (
    <LearnerPage
      title="الترميم"
      description="مقاطع تحتاج إلى تثبيت إضافي قبل أن تستقر في الحفظ."
    >
      {state === "loading" || !user ? (
        <LearnerLoading label="جارٍ تحميل مقاطع الترميم..." />
      ) : null}

      {state === "error" ? (
        <LearnerError onRetry={() => void loadRepairSuggestions()} />
      ) : null}

      {state === "ready" ? (
        units.length === 0 ? (
          <section className="rounded-xl border border-dashed px-5 py-8 sm:px-6">
            <p className="text-sm leading-7 text-muted-foreground">
              لا توجد مقاطع تحتاج إلى ترميم حاليًا.
            </p>
          </section>
        ) : (
          <section className="mx-auto max-w-4xl space-y-8" aria-label="مقاطع الترميم">
            {unitsByMatn.map(({ matnName, units: matnUnits }) => (
              <section key={matnUnits[0]?.matnId} className="space-y-4">
                <h2 className="px-1 text-lg font-semibold text-foreground">{matnName}</h2>
                <div className="space-y-4">
                  {matnUnits.map((unit) => (
                    <RepairUnitCard key={unit.id} unit={unit} />
                  ))}
                </div>
              </section>
            ))}
          </section>
        )
      ) : null}
    </LearnerPage>
  );
}
