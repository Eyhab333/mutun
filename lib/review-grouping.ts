import { getPassagePosition } from "@/lib/matn-passage-sequence";
import type { ActiveMatnPassageSequence } from "@/lib/firestore/matn-progress";
import type { Matn, Passage, ReviewGroup, ReviewStage } from "@/types";

export type DueReviewGroup = {
  group: ReviewGroup;
  dueAt: Date;
};

export type SuggestedReviewPassage = {
  passage: Passage;
  position: number;
};

export type SuggestedReviewSpan = {
  sourceReviewGroupId: string;
  passageIds: string[];
  startPassageId: string;
  endPassageId: string;
  startPosition: number;
  endPosition: number;
  dueAt: Date;
};

export type SuggestedReviewUnit = {
  id: string;
  matn: Matn;
  matnId: string;
  reviewStage: ReviewStage;
  spans: SuggestedReviewSpan[];
  sourceReviewGroupIds: string[];
  passageIds: string[];
  passages: SuggestedReviewPassage[];
  sequence: readonly Passage[];
  startPassageId: string;
  endPassageId: string;
  startPosition: number;
  endPosition: number;
  dueAt: Date;
};

export type SuggestedReviewBuildResult = {
  units: SuggestedReviewUnit[];
  invalidReviewGroupIds: string[];
};

function getReviewSpan(
  dueGroup: DueReviewGroup,
  sequence: ActiveMatnPassageSequence
): SuggestedReviewSpan | null {
  const { group, dueAt } = dueGroup;
  const uniquePassageIds = Array.from(new Set(group.passageIds));

  if (
    uniquePassageIds.length === 0 ||
    !uniquePassageIds.includes(group.startPassageId) ||
    !uniquePassageIds.includes(group.endPassageId)
  ) {
    return null;
  }

  const positions = uniquePassageIds
    .map((passageId) => ({
      passageId,
      position: getPassagePosition(sequence.passages, passageId),
    }))
    .sort((first, second) => (first.position ?? Infinity) - (second.position ?? Infinity));

  if (positions.some((item) => item.position === null)) {
    return null;
  }

  const startPosition = getPassagePosition(
    sequence.passages,
    group.startPassageId
  );
  const endPosition = getPassagePosition(sequence.passages, group.endPassageId);

  if (
    startPosition === null ||
    endPosition === null ||
    startPosition > endPosition ||
    positions.length !== endPosition - startPosition + 1
  ) {
    return null;
  }

  const isContiguous = positions.every(
    (item, index) => item.position === startPosition + index
  );

  if (!isContiguous) {
    return null;
  }

  return {
    sourceReviewGroupId: group.id,
    passageIds: positions.map((item) => item.passageId),
    startPassageId: group.startPassageId,
    endPassageId: group.endPassageId,
    startPosition,
    endPosition,
    dueAt,
  };
}

function createSuggestedReviewUnit(
  matn: Matn,
  reviewStage: ReviewStage,
  spans: readonly SuggestedReviewSpan[],
  sequence: readonly Passage[]
): SuggestedReviewUnit {
  const firstSpan = spans[0];
  const lastSpan = spans.at(-1) ?? firstSpan;
  const passageIds = spans.flatMap((span) => span.passageIds);
  const passages = sequence
    .slice(firstSpan.startPosition - 1, lastSpan.endPosition)
    .map((passage, index) => ({
      passage,
      position: firstSpan.startPosition + index,
    }));

  return {
    id: `suggested:${spans.map((span) => span.sourceReviewGroupId).join("|")}`,
    matn,
    matnId: matn.id,
    reviewStage,
    spans: [...spans],
    sourceReviewGroupIds: spans.map((span) => span.sourceReviewGroupId),
    passageIds,
    passages,
    sequence,
    startPassageId: firstSpan.startPassageId,
    endPassageId: lastSpan.endPassageId,
    startPosition: firstSpan.startPosition,
    endPosition: lastSpan.endPosition,
    dueAt: new Date(Math.min(...spans.map((span) => span.dueAt.getTime()))),
  };
}

export function buildSuggestedReviewUnits(
  dueGroups: readonly DueReviewGroup[],
  sequences: ReadonlyMap<string, ActiveMatnPassageSequence>
): SuggestedReviewBuildResult {
  const spansByMatnAndStage = new Map<
    string,
    { matn: Matn; reviewStage: ReviewStage; spans: SuggestedReviewSpan[]; sequence: Passage[] }
  >();
  const invalidReviewGroupIds: string[] = [];

  for (const dueGroup of dueGroups) {
    const sequence = sequences.get(dueGroup.group.matnId);

    if (!sequence) {
      invalidReviewGroupIds.push(dueGroup.group.id);
      continue;
    }

    const span = getReviewSpan(dueGroup, sequence);

    if (!span) {
      invalidReviewGroupIds.push(dueGroup.group.id);
      continue;
    }

    const key = `${dueGroup.group.matnId}:${dueGroup.group.reviewStage}`;
    const existing = spansByMatnAndStage.get(key);

    if (existing) {
      existing.spans.push(span);
    } else {
      spansByMatnAndStage.set(key, {
        matn: sequence.matn,
        reviewStage: dueGroup.group.reviewStage,
        spans: [span],
        sequence: sequence.passages,
      });
    }
  }

  const units: SuggestedReviewUnit[] = [];

  for (const { matn, reviewStage, spans, sequence } of spansByMatnAndStage.values()) {
    const orderedSpans = spans
      .slice()
      .sort((first, second) => first.startPosition - second.startPosition);
    let currentSpans: SuggestedReviewSpan[] = [];

    for (const span of orderedSpans) {
      const previousSpan = currentSpans.at(-1);

      if (!previousSpan || span.startPosition === previousSpan.endPosition + 1) {
        currentSpans.push(span);
        continue;
      }

      units.push(createSuggestedReviewUnit(matn, reviewStage, currentSpans, sequence));
      currentSpans = [span];
    }

    if (currentSpans.length > 0) {
      units.push(createSuggestedReviewUnit(matn, reviewStage, currentSpans, sequence));
    }
  }

  return {
    units: units.sort((first, second) => first.dueAt.getTime() - second.dueAt.getTime()),
    invalidReviewGroupIds,
  };
}

export function getAdjustedSuggestedReviewUnit(
  unit: SuggestedReviewUnit,
  startSpanIndex: number,
  endSpanIndex: number
) {
  const firstIndex = Math.max(0, Math.min(startSpanIndex, endSpanIndex));
  const lastIndex = Math.min(
    unit.spans.length - 1,
    Math.max(startSpanIndex, endSpanIndex)
  );
  const spans = unit.spans.slice(firstIndex, lastIndex + 1);

  return createSuggestedReviewUnit(
    unit.matn,
    unit.reviewStage,
    spans,
    unit.sequence
  );
}
