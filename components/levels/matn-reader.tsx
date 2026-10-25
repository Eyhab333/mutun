"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { AddToTodayButton } from "@/components/levels/add-to-today-button";
import { MatnStructureTree } from "@/components/levels/matn-structure-tree";
import { PassageResources } from "@/components/passage-resources";
import { WeakPassageButton } from "@/components/weak-passage-button";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { writeBrowseResume } from "@/lib/browse-resume";
import {
  getActiveMatnContext,
  listActiveChapters,
  listActiveMaqasid,
  listActiveMatnStructure,
  listActivePassages,
  listActiveSections,
  type LearnerMatnStructure,
  type LearnerMatnContext,
} from "@/lib/firestore/learner-content";
import {
  getMatnProgressSummary,
  type MatnProgressSummary,
} from "@/lib/firestore/matn-progress";
import { listHistoricalReviewPassageIdsForUser } from "@/lib/firestore/reviews";
import { listActivePassageIdsForUser } from "@/lib/firestore/user-active-passages";
import { listWeakPassageStates } from "@/lib/firestore/user-passage-states";
import type {
  Chapter,
  Maqsad,
  Passage,
  Section,
} from "@/types";

import {
  LearnerError,
  LearnerLoading,
  LearnerNotFound,
  LearnerPage,
} from "./learner-page";

export type ReaderSelection = {
  maqsadId?: string;
  chapterId?: string;
  sectionId?: string;
  passageId?: string;
};

type ReaderModel = {
  context: LearnerMatnContext;
  maqasid: Maqsad[];
  chapters: Chapter[];
  sections: Section[];
  passages: Passage[];
  selectedMaqsad: Maqsad | null;
  selectedChapter: Chapter | null;
  selectedSection: Section | null;
  passageAnchorId?: string;
  emptyMessage?: string;
};

type ReaderState = "loading" | "ready" | "not-found" | "error";

function selectRequestedItem<T extends { id: string }>(
  items: readonly T[],
  requestedId?: string
) {
  return items.find((item) => item.id === requestedId) ?? items[0] ?? null;
}

function PassageReadingList({
  model,
  userId,
  activeTodayPassageIds,
  isTodayStateLoading,
  isTodayStateUnavailable,
  reviewedPassageIds,
  isReviewStateLoading,
  isReviewStateUnavailable,
  weakPassageIds,
  isWeakStateReady,
  onAddedToToday,
  onWeakChange,
}: {
  model: ReaderModel;
  userId: string | null;
  activeTodayPassageIds: ReadonlySet<string>;
  isTodayStateLoading: boolean;
  isTodayStateUnavailable: boolean;
  reviewedPassageIds: ReadonlySet<string>;
  isReviewStateLoading: boolean;
  isReviewStateUnavailable: boolean;
  weakPassageIds: ReadonlySet<string>;
  isWeakStateReady: boolean;
  onAddedToToday: (passageId: string) => void;
  onWeakChange: (passageId: string, isWeak: boolean) => void;
}) {
  const { matn } = model.context;
  const isPoetry = matn.type === "POETRY";
  const itemLabel = isPoetry ? "البيت" : "المقطع";
  const collectionLabel = isPoetry ? "الأبيات" : "المقاطع";

  if (model.emptyMessage) {
    return (
      <p className="rounded-xl border border-dashed px-5 py-8 text-sm leading-7 text-muted-foreground">
        {model.emptyMessage}
      </p>
    );
  }

  if (model.passages.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-5 py-8 text-sm leading-7 text-muted-foreground">
        {isPoetry ? "لا توجد أبيات في هذا القسم بعد." : "لا توجد مقاطع في هذا القسم بعد."}
      </p>
    );
  }

  return (
    <article aria-label={collectionLabel} className="space-y-9 sm:space-y-11">
      {model.passages.map((passage, index) => (
        <section
          key={passage.id}
          id={`passage-${passage.id}`}
          className="scroll-mt-28 border-b pb-9 last:border-b-0 last:pb-0 sm:pb-11"
        >
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            {itemLabel} {index + 1}
          </p>
          <p className="whitespace-pre-wrap text-lg leading-10 text-foreground sm:text-xl sm:leading-[2.8rem]">
            {passage.text}
          </p>
          <PassageResources passageId={passage.id} variant="reader" />
          {userId ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {isWeakStateReady ? (
                <WeakPassageButton
                  userId={userId}
                  passage={passage}
                  isWeak={weakPassageIds.has(passage.id)}
                  onWeakChange={onWeakChange}
                />
              ) : null}
              {isReviewStateLoading ? (
                <span className="text-sm text-muted-foreground">
                  جارٍ التحقق من حالة المراجعة...
                </span>
              ) : isReviewStateUnavailable ? (
                <span className="text-sm text-muted-foreground">
                  تعذر التحقق من حالة المراجعة
                </span>
              ) : reviewedPassageIds.has(passage.id) ? (
                <Badge
                  variant="secondary"
                  className="h-6 gap-1.5 border border-border bg-muted px-2.5 text-muted-foreground"
                >
                  <CheckCircle2 className="size-3.5" />
                  تم الحفظ · في المراجعة
                </Badge>
              ) : (
                <AddToTodayButton
                  userId={userId}
                  passage={passage}
                  isAdded={activeTodayPassageIds.has(passage.id)}
                  isChecking={isTodayStateLoading}
                  isUnavailable={isTodayStateUnavailable}
                  onAdded={onAddedToToday}
                />
              )}
            </div>
          ) : null}
        </section>
      ))}
    </article>
  );
}

function MatnProgressMessage({
  matnType,
  summary,
}: {
  matnType: "PROSE" | "POETRY";
  summary: MatnProgressSummary | null;
}) {
  if (!summary || summary.totalPassages === 0) {
    return null;
  }

  const itemLabel = matnType === "POETRY" ? "البيت" : "المقطع";

  return (
    <p className="text-sm leading-7 text-muted-foreground">
      {summary.currentPosition === null
        ? "لم تبدأ الحفظ بعد"
        : `وصلت إلى ${itemLabel} ${summary.currentPosition} من ${summary.totalPassages}`}
    </p>
  );
}

export function MatnReader({
  levelId,
  scienceId,
  matnId,
  initialSelection,
}: {
  levelId: string;
  scienceId: string;
  matnId: string;
  initialSelection: ReaderSelection;
}) {
  const { user } = useAuth();
  const [state, setState] = React.useState<ReaderState>("loading");
  const [model, setModel] = React.useState<ReaderModel | null>(null);
  const [treeStructure, setTreeStructure] =
    React.useState<LearnerMatnStructure | null>(null);
  const [treeState, setTreeState] = React.useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [activeTodayPassageIds, setActiveTodayPassageIds] = React.useState<
    Set<string>
  >(new Set());
  const [todayState, setTodayState] = React.useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [todayStateScopeKey, setTodayStateScopeKey] = React.useState("");
  const [reviewedPassageIds, setReviewedPassageIds] = React.useState<Set<string>>(
    new Set()
  );
  const [reviewState, setReviewState] = React.useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [reviewStateScopeKey, setReviewStateScopeKey] = React.useState("");
  const [matnProgressSummary, setMatnProgressSummary] =
    React.useState<MatnProgressSummary | null>(null);
  const [weakPassageIds, setWeakPassageIds] = React.useState<Set<string>>(
    new Set()
  );
  const [weakState, setWeakState] = React.useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const contextRef = React.useRef<LearnerMatnContext | null>(null);
  const requestRef = React.useRef(0);
  const lastSelectionRef = React.useRef<ReaderSelection>(initialSelection);
  const todayScopeKey = `${user?.uid ?? "anonymous"}:${(model?.passages ?? [])
    .map((passage) => passage.id)
    .join(",")}`;

  const loadReader = React.useCallback(
    async (selection: ReaderSelection) => {
      const requestId = ++requestRef.current;
      lastSelectionRef.current = selection;
      setState("loading");
      setModel(null);

      try {
        const cachedContext = contextRef.current;
        const context =
          cachedContext &&
          cachedContext.level.id === levelId &&
          cachedContext.science.id === scienceId &&
          cachedContext.matn.id === matnId
            ? cachedContext
            : await getActiveMatnContext(levelId, scienceId, matnId);

        if (requestId !== requestRef.current) {
          return;
        }

        if (!context) {
          contextRef.current = null;
          setState("not-found");
          return;
        }

        contextRef.current = context;
        const { matn } = context;
        const maqasid = matn.hasMaqasid ? await listActiveMaqasid(matn.id) : [];

        if (requestId !== requestRef.current) {
          return;
        }

        const selectedMaqsad = matn.hasMaqasid
          ? selectRequestedItem(maqasid, selection.maqsadId)
          : null;

        if (matn.hasMaqasid && !selectedMaqsad) {
          const emptyModel: ReaderModel = {
            context,
            maqasid,
            chapters: [],
            sections: [],
            passages: [],
            selectedMaqsad: null,
            selectedChapter: null,
            selectedSection: null,
            emptyMessage: "لا توجد مقاصد متاحة في هذا المتن بعد.",
          };

          writeBrowseResume({
            levelId: context.level.id,
            scienceId: context.science.id,
            matnId: matn.id,
            matnName: matn.name,
          });
          setModel(emptyModel);
          setState("ready");
          return;
        }

        const chapterParent = {
          matnId: matn.id,
          ...(selectedMaqsad ? { maqsadId: selectedMaqsad.id } : {}),
        };
        const chapters = matn.hasChapters
          ? await listActiveChapters(chapterParent)
          : [];

        if (requestId !== requestRef.current) {
          return;
        }

        const selectedChapter = matn.hasChapters
          ? selectRequestedItem(chapters, selection.chapterId)
          : null;

        if (matn.hasChapters && !selectedChapter) {
          const emptyModel: ReaderModel = {
            context,
            maqasid,
            chapters,
            sections: [],
            passages: [],
            selectedMaqsad,
            selectedChapter: null,
            selectedSection: null,
            emptyMessage: "لا توجد أبواب متاحة في هذا الموضع بعد.",
          };

          writeBrowseResume({
            levelId: context.level.id,
            scienceId: context.science.id,
            matnId: matn.id,
            ...(selectedMaqsad ? { maqsadId: selectedMaqsad.id } : {}),
            matnName: matn.name,
            ...(selectedMaqsad ? { contextTitle: selectedMaqsad.title } : {}),
          });
          setModel(emptyModel);
          setState("ready");
          return;
        }

        const sectionParent = {
          ...chapterParent,
          ...(selectedChapter ? { chapterId: selectedChapter.id } : {}),
        };
        const sections = matn.hasSections
          ? await listActiveSections(sectionParent)
          : [];

        if (requestId !== requestRef.current) {
          return;
        }

        const selectedSection = matn.hasSections
          ? selectRequestedItem(sections, selection.sectionId)
          : null;

        if (matn.hasSections && !selectedSection) {
          const deepestTitle = selectedChapter?.title ?? selectedMaqsad?.title;
          const emptyModel: ReaderModel = {
            context,
            maqasid,
            chapters,
            sections,
            passages: [],
            selectedMaqsad,
            selectedChapter,
            selectedSection: null,
            emptyMessage: "لا توجد فصول متاحة في هذا الموضع بعد.",
          };

          writeBrowseResume({
            levelId: context.level.id,
            scienceId: context.science.id,
            matnId: matn.id,
            ...(selectedMaqsad ? { maqsadId: selectedMaqsad.id } : {}),
            ...(selectedChapter ? { chapterId: selectedChapter.id } : {}),
            matnName: matn.name,
            ...(deepestTitle ? { contextTitle: deepestTitle } : {}),
          });
          setModel(emptyModel);
          setState("ready");
          return;
        }

        const passageParent = {
          ...sectionParent,
          ...(selectedSection ? { sectionId: selectedSection.id } : {}),
        };
        const passages = await listActivePassages(passageParent);

        if (requestId !== requestRef.current) {
          return;
        }

        const passageAnchorId = passages.some(
          (passage) => passage.id === selection.passageId
        )
          ? selection.passageId
          : undefined;
        const deepestTitle =
          selectedSection?.title ?? selectedChapter?.title ?? selectedMaqsad?.title;

        writeBrowseResume({
          levelId: context.level.id,
          scienceId: context.science.id,
          matnId: matn.id,
          ...(selectedMaqsad ? { maqsadId: selectedMaqsad.id } : {}),
          ...(selectedChapter ? { chapterId: selectedChapter.id } : {}),
          ...(selectedSection ? { sectionId: selectedSection.id } : {}),
          ...(passageAnchorId ? { passageId: passageAnchorId } : {}),
          matnName: matn.name,
          ...(deepestTitle ? { contextTitle: deepestTitle } : {}),
        });

        setModel({
          context,
          maqasid,
          chapters,
          sections,
          passages,
          selectedMaqsad,
          selectedChapter,
          selectedSection,
          ...(passageAnchorId ? { passageAnchorId } : {}),
        });
        setState("ready");
      } catch {
        if (requestId === requestRef.current) {
          setState("error");
        }
      }
    },
    [levelId, matnId, scienceId]
  );

  React.useEffect(() => {
    contextRef.current = null;
    void loadReader(initialSelection);
  }, [initialSelection, loadReader]);

  React.useEffect(() => {
    let isCurrent = true;
    setTreeStructure(null);
    setTreeState("loading");

    void listActiveMatnStructure(matnId)
      .then((structure) => {
        if (isCurrent) {
          setTreeStructure(structure);
          setTreeState("ready");
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to load Matn structure tree.", error);
        }

        if (isCurrent) {
          setTreeStructure(null);
          setTreeState("unavailable");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [matnId]);

  React.useEffect(() => {
    const passages = model?.passages ?? [];

    if (!user?.uid || passages.length === 0) {
      setActiveTodayPassageIds(new Set());
      setTodayState("ready");
      setTodayStateScopeKey(todayScopeKey);
      return;
    }

    let isCurrent = true;
    setTodayState("loading");

    void listActivePassageIdsForUser(
      user.uid,
      passages.map((passage) => passage.id)
    )
      .then((ids) => {
        if (isCurrent) {
          setActiveTodayPassageIds(ids);
          setTodayState("ready");
          setTodayStateScopeKey(todayScopeKey);
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to load Today status for passages.", error);
        }

        if (isCurrent) {
          setActiveTodayPassageIds(new Set());
          setTodayState("unavailable");
          setTodayStateScopeKey(todayScopeKey);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [model?.passages, todayScopeKey, user?.uid]);

  React.useEffect(() => {
    const currentMatnId = model?.context.matn.id;

    if (!user?.uid || !currentMatnId) {
      setMatnProgressSummary(null);
      return;
    }

    let isCurrent = true;
    setMatnProgressSummary(null);

    void getMatnProgressSummary(user.uid, currentMatnId)
      .then((summary) => {
        if (isCurrent) {
          setMatnProgressSummary(summary);
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to load Matn progress.", error);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [model?.context.matn.id, user?.uid]);

  React.useEffect(() => {
    const passages = model?.passages ?? [];

    if (!user?.uid || passages.length === 0) {
      setReviewedPassageIds(new Set());
      setReviewState("ready");
      setReviewStateScopeKey(todayScopeKey);
      return;
    }

    let isCurrent = true;
    setReviewState("loading");

    void listHistoricalReviewPassageIdsForUser(
      user.uid,
      passages.map((passage) => passage.id)
    )
      .then((ids) => {
        if (isCurrent) {
          setReviewedPassageIds(ids);
          setReviewState("ready");
          setReviewStateScopeKey(todayScopeKey);
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to load passage review history.", error);
        }

        if (isCurrent) {
          setReviewedPassageIds(new Set());
          setReviewState("unavailable");
          setReviewStateScopeKey(todayScopeKey);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [model?.passages, todayScopeKey, user?.uid]);

  React.useEffect(() => {
    const passages = model?.passages ?? [];

    if (!user?.uid || passages.length === 0) {
      setWeakPassageIds(new Set());
      setWeakState("ready");
      return;
    }

    let isCurrent = true;
    const visiblePassageIds = new Set(passages.map((passage) => passage.id));
    setWeakState("loading");

    void listWeakPassageStates(user.uid)
      .then((states) => {
        if (isCurrent) {
          setWeakPassageIds(
            new Set(
              states
                .filter((state) => visiblePassageIds.has(state.passageId))
                .map((state) => state.passageId)
            )
          );
          setWeakState("ready");
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to load passage weakness states.", error);
        }

        if (isCurrent) {
          setWeakPassageIds(new Set());
          setWeakState("unavailable");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [model?.passages, user?.uid]);

  React.useEffect(() => {
    if (!model?.passageAnchorId || state !== "ready") {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      document
        .getElementById(`passage-${model.passageAnchorId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [model?.passageAnchorId, state]);

  function markPassageAddedToToday(passageId: string) {
    setActiveTodayPassageIds((current) => new Set(current).add(passageId));
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

  const context = model?.context;
  const breadcrumbs = context
    ? [
        { label: "المستويات العلمية", href: "/levels" },
        { label: context.level.name, href: `/levels/${context.level.id}` },
        {
          label: context.science.name,
          href: `/levels/${context.level.id}/sciences/${context.science.id}`,
        },
        { label: context.matn.name },
        ...(model?.selectedMaqsad ? [{ label: model.selectedMaqsad.title }] : []),
        ...(model?.selectedChapter ? [{ label: model.selectedChapter.title }] : []),
        ...(model?.selectedSection ? [{ label: model.selectedSection.title }] : []),
      ]
    : [];

  return (
    <LearnerPage
      title={context?.matn.name ?? "المتن"}
      description={context?.matn.description ?? "قراءة المتن بحسب بنيته العلمية."}
      breadcrumbs={breadcrumbs}
    >
      {state === "loading" ? <LearnerLoading label="جارٍ تحميل المتن..." /> : null}
      {state === "error" ? (
        <LearnerError
          onRetry={() => void loadReader(lastSelectionRef.current)}
        />
      ) : null}
      {state === "not-found" ? (
        <LearnerNotFound message="هذا المتن غير متاح ضمن المسار المحدد." />
      ) : null}
      {state === "ready" && model ? (
        <div className="space-y-8">
          <MatnProgressMessage
            matnType={model.context.matn.type}
            summary={matnProgressSummary}
          />
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(15rem,0.38fr)_minmax(0,1fr)]">
            <aside className="rounded-xl border bg-card p-3 sm:p-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
              {treeState === "loading" ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  جارٍ تحميل البنية...
                </p>
              ) : null}
              {treeState === "unavailable" ? (
                <p className="px-2 py-3 text-sm leading-6 text-muted-foreground">
                  تعذر تحميل بنية المتن.
                </p>
              ) : null}
              {treeState === "ready" && treeStructure ? (
                <MatnStructureTree
                  levelId={levelId}
                  scienceId={scienceId}
                  matn={model.context.matn}
                  maqasid={treeStructure.maqasid}
                  chapters={treeStructure.chapters}
                  sections={treeStructure.sections}
                  passages={treeStructure.passages}
                  currentPassageId={initialSelection.passageId}
                />
              ) : null}
            </aside>

            <section className="min-w-0">
            <h2 className="mb-7 text-lg font-semibold tracking-tight text-foreground">
              {model.context.matn.type === "POETRY" ? "الأبيات" : "المقاطع"}
            </h2>
            <PassageReadingList
              model={model}
              userId={user?.uid ?? null}
              activeTodayPassageIds={activeTodayPassageIds}
              isTodayStateLoading={
                todayStateScopeKey !== todayScopeKey || todayState === "loading"
              }
              isTodayStateUnavailable={
                todayStateScopeKey === todayScopeKey && todayState === "unavailable"
              }
              reviewedPassageIds={reviewedPassageIds}
              isReviewStateLoading={
                reviewStateScopeKey !== todayScopeKey || reviewState === "loading"
              }
              isReviewStateUnavailable={
                reviewStateScopeKey === todayScopeKey && reviewState === "unavailable"
              }
              weakPassageIds={weakPassageIds}
              isWeakStateReady={weakState === "ready"}
              onAddedToToday={markPassageAddedToToday}
              onWeakChange={updatePassageWeakState}
            />
            </section>
          </div>
        </div>
      ) : null}
    </LearnerPage>
  );
}
