import type { Chapter, Maqsad, Matn, Passage, Section } from "@/types";

type OrderedContent = {
  id: string;
  order: number;
  isActive: boolean;
  isArchived: boolean;
};

type PassageContext = {
  maqsadId?: string;
  chapterId?: string;
  sectionId?: string;
};

export type MatnPassageSequenceInput = {
  matn: Matn;
  maqasid: readonly Maqsad[];
  chapters: readonly Chapter[];
  sections: readonly Section[];
  passages: readonly Passage[];
};

function isVisibleContent(item: OrderedContent) {
  return item.isActive && !item.isArchived;
}

function sortByScientificOrder<T extends OrderedContent>(items: readonly T[]) {
  return items
    .filter(isVisibleContent)
    .slice()
    .sort((first, second) => {
      const orderDifference = first.order - second.order;

      return orderDifference !== 0
        ? orderDifference
        : first.id.localeCompare(second.id);
    });
}

function hasPassageContext(passage: Passage, context: PassageContext) {
  return (
    passage.maqsadId === context.maqsadId &&
    passage.chapterId === context.chapterId &&
    passage.sectionId === context.sectionId
  );
}

/**
 * Builds the learner-visible scientific order for one Matn. Passage `order`
 * values are sibling-local, so hierarchy order is always applied first.
 */
export function buildMatnPassageSequence({
  matn,
  maqasid,
  chapters,
  sections,
  passages,
}: MatnPassageSequenceInput): Passage[] {
  const orderedMaqasid = sortByScientificOrder(
    maqasid.filter((maqsad) => maqsad.matnId === matn.id)
  );
  const orderedChapters = sortByScientificOrder(
    chapters.filter((chapter) => chapter.matnId === matn.id)
  );
  const orderedSections = sortByScientificOrder(
    sections.filter((section) => section.matnId === matn.id)
  );
  const orderedPassages = sortByScientificOrder(
    passages.filter((passage) => passage.matnId === matn.id)
  );
  const sequence: Passage[] = [];

  const appendPassages = (context: PassageContext) => {
    sequence.push(
      ...orderedPassages.filter((passage) => hasPassageContext(passage, context))
    );
  };

  if (matn.hasMaqasid) {
    for (const maqsad of orderedMaqasid) {
      if (matn.hasChapters) {
        const maqsadChapters = orderedChapters.filter(
          (chapter) => chapter.maqsadId === maqsad.id
        );

        for (const chapter of maqsadChapters) {
          if (matn.hasSections) {
            const chapterSections = orderedSections.filter(
              (section) =>
                section.maqsadId === maqsad.id && section.chapterId === chapter.id
            );

            for (const section of chapterSections) {
              appendPassages({
                maqsadId: maqsad.id,
                chapterId: chapter.id,
                sectionId: section.id,
              });
            }
          } else {
            appendPassages({ maqsadId: maqsad.id, chapterId: chapter.id });
          }
        }
      } else if (matn.hasSections) {
        const maqsadSections = orderedSections.filter(
          (section) => section.maqsadId === maqsad.id && !section.chapterId
        );

        for (const section of maqsadSections) {
          appendPassages({ maqsadId: maqsad.id, sectionId: section.id });
        }
      } else {
        appendPassages({ maqsadId: maqsad.id });
      }
    }

    return sequence;
  }

  if (matn.hasChapters) {
    const directChapters = orderedChapters.filter((chapter) => !chapter.maqsadId);

    for (const chapter of directChapters) {
      if (matn.hasSections) {
        const chapterSections = orderedSections.filter(
          (section) => !section.maqsadId && section.chapterId === chapter.id
        );

        for (const section of chapterSections) {
          appendPassages({ chapterId: chapter.id, sectionId: section.id });
        }
      } else {
        appendPassages({ chapterId: chapter.id });
      }
    }

    return sequence;
  }

  if (matn.hasSections) {
    const directSections = orderedSections.filter(
      (section) => !section.maqsadId && !section.chapterId
    );

    for (const section of directSections) {
      appendPassages({ sectionId: section.id });
    }

    return sequence;
  }

  appendPassages({});

  return sequence;
}

export function getPassagePosition(
  sequence: readonly Passage[],
  passageId: string
) {
  const index = sequence.findIndex((passage) => passage.id === passageId);

  return index === -1 ? null : index + 1;
}

export function isPassageFarther(
  sequence: readonly Passage[],
  currentFarthestPassageId: string | null,
  candidatePassageId: string
) {
  const candidatePosition = getPassagePosition(sequence, candidatePassageId);

  if (candidatePosition === null) {
    return false;
  }

  const currentPosition = currentFarthestPassageId
    ? getPassagePosition(sequence, currentFarthestPassageId)
    : null;

  return currentPosition === null || candidatePosition > currentPosition;
}
