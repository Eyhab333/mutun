import type { ReviewStage } from "@/types";

import { normalizeRepetitionLevels } from "./repetition-levels";

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

export type ReviewSchedule = {
  reviewStage: ReviewStage;
  dueDateKey: string;
};

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDateKey({ year, month, day }: LocalDateParts) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function parseLocalDateKey(dateKey: string): LocalDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error("Invalid local date key.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid local calendar date.");
  }

  return { year, month, day };
}

function getLocalNoon(dateKey: string) {
  const { year, month, day } = parseLocalDateKey(dateKey);

  return new Date(year, month - 1, day, 12);
}

function getDateKeyFromLocalDate(date: Date) {
  return formatLocalDateKey({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function getFirstReviewThreshold(levels: readonly number[] | undefined) {
  return normalizeRepetitionLevels(levels)[0];
}

export function didCrossRepetitionThreshold({
  previousCount,
  nextCount,
  threshold,
}: {
  previousCount: number;
  nextCount: number;
  threshold: number;
}) {
  return previousCount < threshold && nextCount >= threshold;
}

export function addLocalCalendarDays(dateKey: string, days: number) {
  const date = getLocalNoon(dateKey);
  date.setDate(date.getDate() + days);

  return getDateKeyFromLocalDate(date);
}

export function addLocalCalendarMonth(dateKey: string) {
  const { year, month, day } = parseLocalDateKey(dateKey);
  const targetMonthIndex = month;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

  return formatLocalDateKey({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, lastDayOfTargetMonth),
  });
}

export function getReviewDueDateTime(dateKey: string) {
  return getLocalNoon(dateKey);
}

export function getEndOfLocalDay(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

export function isLocalDateKeyAfter(candidateDateKey: string, referenceDateKey: string) {
  return getLocalNoon(candidateDateKey).getTime() > getLocalNoon(referenceDateKey).getTime();
}

export function getInitialReviewSchedule(practiceDateKey: string): ReviewSchedule {
  return {
    reviewStage: "AFTER_7_DAYS",
    dueDateKey: addLocalCalendarDays(practiceDateKey, 7),
  };
}

export function getNextReviewSchedule({
  completedStage,
  completedDateKey,
}: {
  completedStage: ReviewStage;
  completedDateKey: string;
}): ReviewSchedule {
  switch (completedStage) {
    case "AFTER_7_DAYS":
      return {
        reviewStage: "AFTER_30_DAYS",
        dueDateKey: addLocalCalendarDays(completedDateKey, 30),
      };
    case "AFTER_30_DAYS":
    case "MONTHLY":
      return {
        reviewStage: "MONTHLY",
        dueDateKey: addLocalCalendarMonth(completedDateKey),
      };
  }
}

export function getReviewStageLabel(stage: ReviewStage) {
  switch (stage) {
    case "AFTER_7_DAYS":
      return "مراجعة 7 أيام";
    case "AFTER_30_DAYS":
      return "مراجعة 30 يومًا";
    case "MONTHLY":
      return "مراجعة شهرية";
  }
}
