"use client";

import * as React from "react";

import {
  getActiveLevel,
  getActiveScience,
  listActiveMatn,
} from "@/lib/firestore/learner-content";
import type { Level, Matn, Science } from "@/types";

import {
  LearnerError,
  LearnerList,
  LearnerLoading,
  LearnerNotFound,
  LearnerPage,
} from "./learner-page";

type ViewState = "loading" | "ready" | "not-found" | "error";

export function ScienceMatn({
  levelId,
  scienceId,
}: {
  levelId: string;
  scienceId: string;
}) {
  const [state, setState] = React.useState<ViewState>("loading");
  const [level, setLevel] = React.useState<Level | null>(null);
  const [science, setScience] = React.useState<Science | null>(null);
  const [matn, setMatn] = React.useState<Matn[]>([]);

  const load = React.useCallback(async () => {
    setState("loading");

    try {
      const [nextLevel, nextScience] = await Promise.all([
        getActiveLevel(levelId),
        getActiveScience(levelId, scienceId),
      ]);

      if (!nextLevel || !nextScience) {
        setLevel(null);
        setScience(null);
        setMatn([]);
        setState("not-found");
        return;
      }

      const nextMatn = await listActiveMatn(nextScience.id);
      setLevel(nextLevel);
      setScience(nextScience);
      setMatn(nextMatn);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [levelId, scienceId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <LearnerPage
      title={science?.name ?? "العلم"}
      description="المتون المتاحة في هذا العلم."
      breadcrumbs={[
        { label: "المستويات العلمية", href: "/levels" },
        ...(level ? [{ label: level.name, href: `/levels/${level.id}` }] : []),
        ...(science ? [{ label: science.name }] : []),
      ]}
    >
      {state === "loading" ? <LearnerLoading label="جارٍ تحميل المتون..." /> : null}
      {state === "error" ? <LearnerError onRetry={() => void load()} /> : null}
      {state === "not-found" ? (
        <LearnerNotFound message="هذا العلم غير متاح ضمن المستوى المحدد." />
      ) : null}
      {state === "ready" ? (
        <LearnerList
          emptyMessage="لا توجد متون في هذا العلم بعد."
          items={matn.map((item) => ({
            id: item.id,
            title: item.name,
            description: item.description,
            meta: item.type === "POETRY" ? "شعر" : "نثر",
            href: `/levels/${levelId}/sciences/${scienceId}/matn/${item.id}`,
          }))}
        />
      ) : null}
    </LearnerPage>
  );
}
