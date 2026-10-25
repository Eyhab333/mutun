"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft } from "lucide-react";

import { buildMatnPassageSequence } from "@/lib/matn-passage-sequence";
import { cn } from "@/lib/utils";
import type { Chapter, Maqsad, Matn, Passage, Section } from "@/types";

type PassageContext = {
  maqsadId?: string;
  chapterId?: string;
  sectionId?: string;
};

type MatnStructureTreeProps = {
  levelId: string;
  scienceId: string;
  matn: Matn;
  maqasid: readonly Maqsad[];
  chapters: readonly Chapter[];
  sections: readonly Section[];
  passages: readonly Passage[];
  currentPassageId?: string;
};

function sortByOrder<T extends { id: string; order: number }>(items: readonly T[]) {
  return items.slice().sort((first, second) => {
    const orderDifference = first.order - second.order;

    return orderDifference !== 0
      ? orderDifference
      : first.id.localeCompare(second.id);
  });
}

function matchesContext(passage: Passage, context: PassageContext) {
  return (
    passage.maqsadId === context.maqsadId &&
    passage.chapterId === context.chapterId &&
    passage.sectionId === context.sectionId
  );
}

function getBranchId(kind: "maqsad" | "chapter" | "section", id: string) {
  return `${kind}:${id}`;
}

function getAncestorBranchIds(passage: Passage | undefined) {
  if (!passage) {
    return [];
  }

  return [
    ...(passage.maqsadId ? [getBranchId("maqsad", passage.maqsadId)] : []),
    ...(passage.chapterId
      ? [getBranchId("chapter", passage.chapterId)]
      : []),
    ...(passage.sectionId
      ? [getBranchId("section", passage.sectionId)]
      : []),
  ];
}

function TreeBranch({
  branchId,
  label,
  isOpen,
  onToggle,
  children,
}: {
  branchId: string;
  label: string;
  isOpen: boolean;
  onToggle: (branchId: string) => void;
  children: React.ReactNode;
}) {
  const hasChildren = React.Children.count(children) > 0;
  const contentId = `${branchId}-children`;

  return (
    <li>
      {hasChildren ? (
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-start text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isOpen}
          aria-controls={contentId}
          aria-label={`${isOpen ? "طي" : "فتح"} ${label}`}
          onClick={() => onToggle(branchId)}
        >
          {isOpen ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{label}</span>
        </button>
      ) : (
        <p className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          {label}
        </p>
      )}

      {hasChildren && isOpen ? (
        <ul id={contentId} className="ms-3 space-y-0.5 border-s ps-2">
          {children}
        </ul>
      ) : null}
    </li>
  );
}

function TreePassage({
  passage,
  position,
  itemLabel,
  href,
  isCurrent,
}: {
  passage: Passage;
  position: number;
  itemLabel: string;
  href: string;
  isCurrent: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          "flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCurrent && "bg-accent text-accent-foreground"
        )}
      >
        <span className="shrink-0 text-xs text-muted-foreground">
          {itemLabel} {position}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {passage.text.replace(/\s+/g, " ").trim()}
        </span>
      </Link>
    </li>
  );
}

export function MatnStructureTree({
  levelId,
  scienceId,
  matn,
  maqasid,
  chapters,
  sections,
  passages,
  currentPassageId,
}: MatnStructureTreeProps) {
  const orderedMaqasid = React.useMemo(() => sortByOrder(maqasid), [maqasid]);
  const orderedChapters = React.useMemo(() => sortByOrder(chapters), [chapters]);
  const orderedSections = React.useMemo(() => sortByOrder(sections), [sections]);
  const orderedPassages = React.useMemo(() => sortByOrder(passages), [passages]);
  const passagePositions = React.useMemo(
    () =>
      new Map(
        buildMatnPassageSequence({
          matn,
          maqasid: orderedMaqasid,
          chapters: orderedChapters,
          sections: orderedSections,
          passages: orderedPassages,
        }).map((passage, index) => [passage.id, index + 1])
      ),
    [matn, orderedChapters, orderedMaqasid, orderedPassages, orderedSections]
  );
  const currentPassage = React.useMemo(
    () => passages.find((passage) => passage.id === currentPassageId),
    [currentPassageId, passages]
  );
  const currentAncestorBranchIds = React.useMemo(
    () => getAncestorBranchIds(currentPassage),
    [currentPassage]
  );
  const [openBranchIds, setOpenBranchIds] = React.useState(
    () => new Set(currentAncestorBranchIds)
  );
  const itemLabel = matn.type === "POETRY" ? "البيت" : "المقطع";
  const basePath = `/levels/${levelId}/sciences/${scienceId}/matn/${matn.id}`;

  React.useEffect(() => {
    if (currentAncestorBranchIds.length === 0) {
      return;
    }

    setOpenBranchIds((current) => {
      const next = new Set(current);
      let didChange = false;

      for (const branchId of currentAncestorBranchIds) {
        if (!next.has(branchId)) {
          next.add(branchId);
          didChange = true;
        }
      }

      return didChange ? next : current;
    });
  }, [currentAncestorBranchIds]);

  function toggleBranch(branchId: string) {
    setOpenBranchIds((current) => {
      const next = new Set(current);

      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }

      return next;
    });
  }

  function getPassageHref(passage: Passage) {
    const searchParams = new URLSearchParams({ passageId: passage.id });

    if (passage.maqsadId) {
      searchParams.set("maqsadId", passage.maqsadId);
    }

    if (passage.chapterId) {
      searchParams.set("chapterId", passage.chapterId);
    }

    if (passage.sectionId) {
      searchParams.set("sectionId", passage.sectionId);
    }

    return `${basePath}?${searchParams.toString()}`;
  }

  function renderPassages(context: PassageContext) {
    return orderedPassages
      .filter(
        (passage) =>
          matchesContext(passage, context) && passagePositions.has(passage.id)
      )
      .map((passage) => (
        <TreePassage
          key={passage.id}
          passage={passage}
          position={passagePositions.get(passage.id)!}
          itemLabel={itemLabel}
          href={getPassageHref(passage)}
          isCurrent={passage.id === currentPassageId}
        />
      ));
  }

  function renderSections(context: PassageContext) {
    return orderedSections
      .filter(
        (section) =>
          section.maqsadId === context.maqsadId &&
          section.chapterId === context.chapterId
      )
      .map((section) => {
        const branchId = getBranchId("section", section.id);

        return (
          <TreeBranch
            key={section.id}
            branchId={branchId}
            label={section.title}
            isOpen={openBranchIds.has(branchId)}
            onToggle={toggleBranch}
          >
            {renderPassages({ ...context, sectionId: section.id })}
          </TreeBranch>
        );
      });
  }

  function renderChapters(context: PassageContext) {
    return orderedChapters
      .filter((chapter) => chapter.maqsadId === context.maqsadId)
      .map((chapter) => {
        const branchId = getBranchId("chapter", chapter.id);
        const children = matn.hasSections
          ? renderSections({ ...context, chapterId: chapter.id })
          : renderPassages({ ...context, chapterId: chapter.id });

        return (
          <TreeBranch
            key={chapter.id}
            branchId={branchId}
            label={chapter.title}
            isOpen={openBranchIds.has(branchId)}
            onToggle={toggleBranch}
          >
            {children}
          </TreeBranch>
        );
      });
  }

  const rootNodes = matn.hasMaqasid
    ? orderedMaqasid.map((maqsad) => {
        const branchId = getBranchId("maqsad", maqsad.id);
        const children = matn.hasChapters
          ? renderChapters({ maqsadId: maqsad.id })
          : matn.hasSections
            ? renderSections({ maqsadId: maqsad.id })
            : renderPassages({ maqsadId: maqsad.id });

        return (
          <TreeBranch
            key={maqsad.id}
            branchId={branchId}
            label={maqsad.title}
            isOpen={openBranchIds.has(branchId)}
            onToggle={toggleBranch}
          >
            {children}
          </TreeBranch>
        );
      })
    : matn.hasChapters
      ? renderChapters({})
      : matn.hasSections
        ? renderSections({})
        : renderPassages({});

  return (
    <nav aria-label="بنية المتن" className="min-w-0">
      <h2 className="mb-2 px-2 text-sm font-medium text-muted-foreground">
        بنية المتن
      </h2>
      {rootNodes.length > 0 ? (
        <ul className="space-y-0.5">{rootNodes}</ul>
      ) : (
        <p className="px-2 py-3 text-sm leading-6 text-muted-foreground">
          لا توجد عناصر متاحة في بنية هذا المتن.
        </p>
      )}
    </nav>
  );
}
