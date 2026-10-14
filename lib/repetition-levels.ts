import { defaultRepetitionLevels } from "@/types";

export type RepetitionLevelStatus = {
  currentReachedLevel: number | null;
  nextLevel: number | null;
  isStarted: boolean;
};

export function normalizeRepetitionLevels(levels: readonly number[] | undefined) {
  const normalized = Array.from(
    new Set(
      (levels ?? [])
        .filter((level) => Number.isInteger(level) && level > 0)
        .map((level) => Number(level))
    )
  ).sort((left, right) => left - right);

  return normalized.length > 0 ? normalized : [...defaultRepetitionLevels];
}

export function getReachedRepetitionLevel(
  count: number,
  levels: readonly number[]
): RepetitionLevelStatus {
  const normalizedLevels = normalizeRepetitionLevels(levels);
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const currentReachedLevel =
    normalizedLevels.filter((level) => level <= safeCount).at(-1) ?? null;
  const nextLevel = normalizedLevels.find((level) => level > safeCount) ?? null;

  return {
    currentReachedLevel,
    nextLevel,
    isStarted: safeCount > 0,
  };
}
