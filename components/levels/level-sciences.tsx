"use client";

import * as React from "react";

import {
  getActiveLevel,
  listActiveSciences,
} from "@/lib/firestore/learner-content";
import type { Level, Science } from "@/types";

import {
  LearnerError,
  LearnerList,
  LearnerLoading,
  LearnerNotFound,
  LearnerPage,
} from "./learner-page";

type ViewState = "loading" | "ready" | "not-found" | "error";

export function LevelSciences({ levelId }: { levelId: string }) {
  const [state, setState] = React.useState<ViewState>("loading");
  const [level, setLevel] = React.useState<Level | null>(null);
  const [sciences, setSciences] = React.useState<Science[]>([]);

  const load = React.useCallback(async () => {
    setState("loading");

    try {
      const nextLevel = await getActiveLevel(levelId);

      if (!nextLevel) {
        setLevel(null);
        setSciences([]);
        setState("not-found");
        return;
      }

      const nextSciences = await listActiveSciences(nextLevel.id);
      setLevel(nextLevel);
      setSciences(nextSciences);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [levelId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <LearnerPage
      title={level?.name ?? "المستوى العلمي"}
      description="العلوم المتاحة في هذا المستوى."
      breadcrumbs={[{ label: "المستويات العلمية", href: "/levels" }, ...(level ? [{ label: level.name }] : [])]}
    >
      {state === "loading" ? <LearnerLoading label="جارٍ تحميل العلوم..." /> : null}
      {state === "error" ? <LearnerError onRetry={() => void load()} /> : null}
      {state === "not-found" ? (
        <LearnerNotFound message="هذا المستوى غير متاح أو لم يعد ظاهرًا في المكتبة." />
      ) : null}
      {state === "ready" ? (
        <LearnerList
          emptyMessage="لا توجد علوم في هذا المستوى بعد."
          items={sciences.map((science) => ({
            id: science.id,
            title: science.name,
            href: `/levels/${levelId}/sciences/${science.id}`,
          }))}
        />
      ) : null}
    </LearnerPage>
  );
}
