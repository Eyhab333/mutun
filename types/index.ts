import type { LucideIcon } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

export type NavigationItem = {
  label: string;
  mobileLabel?: string;
  href: "/" | `/${string}`;
  icon: LucideIcon;
  section: "main" | "secondary";
};

type TimestampedDocument = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ContentStatus = {
  isActive: boolean;
  isArchived: boolean;
};

export type Level = TimestampedDocument &
  ContentStatus & {
    id: string;
    name: string;
    order: number;
  };

export type Science = TimestampedDocument &
  ContentStatus & {
    id: string;
    levelId: string;
    name: string;
    order: number;
  };

export type MatnType = "PROSE" | "POETRY";

export type Matn = TimestampedDocument &
  ContentStatus & {
    id: string;
    levelId: string;
    scienceId: string;
    name: string;
    description?: string;
    type: MatnType;
    hasMaqasid: boolean;
    hasChapters: boolean;
    hasSections: boolean;
    order: number;
  };

export type Maqsad = TimestampedDocument &
  ContentStatus & {
    id: string;
    matnId: string;
    title: string;
    order: number;
  };

export type Chapter = TimestampedDocument &
  ContentStatus & {
    id: string;
    matnId: string;
    maqsadId?: string;
    title: string;
    order: number;
  };

export type Section = TimestampedDocument &
  ContentStatus & {
    id: string;
    matnId: string;
    maqsadId?: string;
    chapterId?: string;
    title: string;
    order: number;
  };

export type Passage = TimestampedDocument &
  ContentStatus & {
    id: string;
    matnId: string;
    maqsadId?: string;
    chapterId?: string;
    sectionId?: string;
    text: string;
    order: number;
  };

export type PassageResourceType = "NOTE" | "YOUTUBE" | "IMAGE" | "AUDIO";

export type PassageResource = TimestampedDocument &
  ContentStatus & {
    id: string;
    passageId: string;
    type: PassageResourceType;
    title?: string;
    text?: string;
    url?: string;
    storagePath?: string;
    order: number;
  };

export type UserPassageState = TimestampedDocument & {
  id: string;
  userId: string;
  passageId: string;
  matnId: string;
  isWeak: boolean;
  weakMarkedAt?: Timestamp;
  weakClearedAt?: Timestamp;
};

export type UserActivePassage = TimestampedDocument & {
  id: string;
  userId: string;
  passageId: string;
  matnId: string;
  isActive: boolean;
  order: number;
  activatedAt: Timestamp;
  deactivatedAt?: Timestamp;
};

export type DailyRepetition = TimestampedDocument & {
  id: string;
  userId: string;
  passageId: string;
  matnId: string;
  dateKey: string;
  repetitionCount: number;
};

export type UserPassageStat = TimestampedDocument & {
  id: string;
  userId: string;
  passageId: string;
  matnId: string;
  totalRepetitions: number;
  practiceDaysCount: number;
  lastRepeatedAt?: Timestamp;
};

export type UserMatnProgress = TimestampedDocument & {
  id: string;
  userId: string;
  matnId: string;
  farthestPassageId: string;
};

export type ReviewStage = "AFTER_7_DAYS" | "AFTER_30_DAYS" | "MONTHLY";

export type ReviewGroup = TimestampedDocument & {
  id: string;
  userId: string;
  matnId: string;
  passageIds: string[];
  startPassageId: string;
  endPassageId: string;
  title?: string;
  isActive: boolean;
  reviewStage: ReviewStage;
  nextReviewAt: Timestamp;
  ignoredAt?: Timestamp;
  lastDeferredAt?: Timestamp;
};

export type ReviewRecord = TimestampedDocument & {
  id: string;
  userId: string;
  /**
   * Source review groups completed together in this execution. The optional
   * singular field is retained only for compatibility with legacy records.
   */
  reviewGroupIds: string[];
  reviewGroupId?: string;
  matnId: string;
  passageIds: string[];
  startPassageId: string;
  endPassageId: string;
  dateKey: string;
  repetitionCount: number;
  reviewStage: ReviewStage;
};

export type RepairRecord = TimestampedDocument & {
  id: string;
  userId: string;
  matnId: string;
  passageIds: string[];
  dateKey: string;
  repetitionCount: number;
};

export type UserSettings = TimestampedDocument & {
  userId: string;
  repetitionLevels: number[];
};

export const defaultRepetitionLevels = [5, 10, 25, 50, 100, 150, 200] as const;

export type BrowseResumeLocation = {
  version: 1;
  levelId: string;
  scienceId: string;
  matnId: string;
  maqsadId?: string;
  chapterId?: string;
  sectionId?: string;
  passageId?: string;
  matnName?: string;
  contextTitle?: string;
  updatedAt: string;
};
