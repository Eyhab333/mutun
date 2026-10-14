import type { Matn, Passage } from "@/types";

export type RepairUnitPassage = {
  passage: Passage;
  position: number;
};

export type SuggestedRepairUnit = {
  id: string;
  matn: Matn;
  matnId: string;
  passages: RepairUnitPassage[];
  passageIds: string[];
  startPosition: number;
  endPosition: number;
};

function createUnit(matn: Matn, passages: RepairUnitPassage[]): SuggestedRepairUnit {
  const first = passages[0];
  const last = passages.at(-1);

  if (!first || !last) {
    throw new Error("A repair unit requires at least one passage.");
  }

  return {
    id: `${matn.id}:${first.passage.id}:${last.passage.id}`,
    matn,
    matnId: matn.id,
    passages,
    passageIds: passages.map((item) => item.passage.id),
    startPosition: first.position,
    endPosition: last.position,
  };
}

export function buildSuggestedRepairUnits({
  matn,
  sequence,
  weakPassageIds,
}: {
  matn: Matn;
  sequence: readonly Passage[];
  weakPassageIds: ReadonlySet<string>;
}) {
  const units: SuggestedRepairUnit[] = [];
  let currentRun: RepairUnitPassage[] = [];

  function saveCurrentRun() {
    if (currentRun.length > 0) {
      units.push(createUnit(matn, currentRun));
      currentRun = [];
    }
  }

  sequence.forEach((passage, index) => {
    if (weakPassageIds.has(passage.id)) {
      currentRun.push({ passage, position: index + 1 });
    } else {
      saveCurrentRun();
    }
  });

  saveCurrentRun();

  return units;
}

export function getAdjustedRepairUnit(
  unit: SuggestedRepairUnit,
  startIndex: number,
  endIndex: number
) {
  const safeStart = Math.max(0, Math.min(startIndex, unit.passages.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(endIndex, unit.passages.length - 1));

  return createUnit(unit.matn, unit.passages.slice(safeStart, safeEnd + 1));
}
