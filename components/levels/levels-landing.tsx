"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clearBrowseResume,
  getBrowseResumeHref,
  readBrowseResume,
} from "@/lib/browse-resume";
import {
  listActiveLevels,
  validateBrowseResumeLocation,
} from "@/lib/firestore/learner-content";
import type { BrowseResumeLocation, Level } from "@/types";

import {
  LearnerError,
  LearnerList,
  LearnerLoading,
  LearnerPage,
} from "./learner-page";

type LoadState = "loading" | "ready" | "error";

export function LevelsLanding() {
  const router = useRouter();
  const [state, setState] = React.useState<LoadState>("loading");
  const [levels, setLevels] = React.useState<Level[]>([]);
  const [resume, setResume] = React.useState<BrowseResumeLocation | null>(null);
  const [isResuming, setIsResuming] = React.useState(false);
  const [resumeError, setResumeError] = React.useState<string | null>(null);

  const loadLevels = React.useCallback(async () => {
    setState("loading");

    try {
      const nextLevels = await listActiveLevels();
      setLevels(nextLevels);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  React.useEffect(() => {
    setResume(readBrowseResume());
    void loadLevels();
  }, [loadLevels]);

  async function resumeBrowsing() {
    if (!resume || isResuming) {
      return;
    }

    setIsResuming(true);
    setResumeError(null);

    try {
      const isValid = await validateBrowseResumeLocation(resume);

      if (!isValid) {
        clearBrowseResume();
        setResume(null);
        setResumeError("لم يعد موضع التصفح المحفوظ متاحًا.");
        return;
      }

      router.push(getBrowseResumeHref(resume));
    } catch {
      setResumeError("تعذر فتح موضع التصفح المحفوظ الآن.");
    } finally {
      setIsResuming(false);
    }
  }

  return (
    <LearnerPage
      title="المستويات العلمية"
      description="اختر المستوى الذي تريد تصفح متونه العلمية فيه."
    >
      <div className="space-y-6">
        {resume ? (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 space-y-0.5">
                <h2 className="font-medium">متابعة من حيث توقفت</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {resume.matnName ?? "آخر موضع مطالعة محفوظ"}
                  {resume.contextTitle ? ` · ${resume.contextTitle}` : ""}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void resumeBrowsing()}
              disabled={isResuming}
              size="sm"
              className="shrink-0"
            >
              {isResuming ? <LoaderCircle className="size-4 animate-spin" /> : "المتابعة"}
            </Button>
          </section>
        ) : null}

        {resumeError ? (
          <p className="text-sm text-muted-foreground">{resumeError}</p>
        ) : null}

        {state === "loading" ? <LearnerLoading label="جارٍ تحميل المستويات..." /> : null}
        {state === "error" ? <LearnerError onRetry={() => void loadLevels()} /> : null}
        {state === "ready" ? (
          <LearnerList
            emptyMessage="لا توجد مستويات علمية متاحة بعد."
            items={levels.map((level) => ({
              id: level.id,
              title: level.name,
              href: `/levels/${level.id}`,
            }))}
          />
        ) : null}
      </div>
    </LearnerPage>
  );
}
