"use client";

import {
  Archive,
  ArchiveRestore,
  FolderOpen,
  GripVertical,
  Pencil,
  Power,
} from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Passage } from "@/types";

type SortablePassageItemProps = {
  passage: Passage;
  index: number;
  group: string;
  isBusy: boolean;
  onEdit: (passage: Passage) => void;
  onManageResources: (passage: Passage) => void;
  onSetActive: (passage: Passage) => void;
  onSetArchived: (passage: Passage) => void;
};

export function SortablePassageItem({
  passage,
  index,
  group,
  isBusy,
  onEdit,
  onManageResources,
  onSetActive,
  onSetArchived,
}: SortablePassageItemProps) {
  const { handleRef, isDragging, isDropTarget, ref } = useSortable({
    id: passage.id,
    index,
    group,
  });

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-background p-2.5 transition-colors",
        isDropTarget && "ring-1 ring-primary/40",
        isDragging && "opacity-50"
      )}
    >
      <button
        ref={handleRef}
        type="button"
        className="mt-0.5 inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`سحب المقطع ${index + 1} لإعادة الترتيب`}
        title="سحب لإعادة الترتيب"
        disabled={isBusy}
      >
        <GripVertical className="size-4" />
      </button>

      <PassageDetails passage={passage} sequence={index + 1} />

      <div className="flex max-w-40 shrink-0 flex-wrap items-center justify-end gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onManageResources(passage)}
          disabled={isBusy}
        >
          <FolderOpen />
          الموارد
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetActive(passage)}
          disabled={isBusy}
          aria-label={passage.isActive ? "إيقاف المقطع" : "تفعيل المقطع"}
          title={passage.isActive ? "إيقاف" : "تفعيل"}
        >
          <Power />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(passage)}
          disabled={isBusy}
          aria-label="تعديل المقطع"
          title="تعديل"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetArchived(passage)}
          disabled={isBusy}
          aria-label="أرشفة المقطع"
          title="أرشفة"
        >
          <Archive />
        </Button>
      </div>
    </li>
  );
}

type ArchivedPassageItemProps = Omit<
  SortablePassageItemProps,
  "index" | "group" | "onSetActive"
>;

export function ArchivedPassageItem({
  passage,
  isBusy,
  onEdit,
  onManageResources,
  onSetArchived,
}: ArchivedPassageItemProps) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-dashed p-2.5">
      <PassageDetails passage={passage} archived />
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onManageResources(passage)}
          disabled={isBusy}
        >
          <FolderOpen />
          الموارد
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(passage)}
          disabled={isBusy}
          aria-label="تعديل المقطع"
          title="تعديل"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetArchived(passage)}
          disabled={isBusy}
          aria-label="استعادة المقطع"
          title="استعادة"
        >
          <ArchiveRestore />
        </Button>
      </div>
    </li>
  );
}

function PassageDetails({
  passage,
  sequence,
  archived = false,
}: {
  passage: Passage;
  sequence?: number;
  archived?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 select-text space-y-1 px-1 py-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {sequence ? `المقطع ${sequence}` : "مقطع مؤرشف"}
        </span>
        {archived ? (
          <Badge variant="secondary">مؤرشف</Badge>
        ) : passage.isActive ? (
          <Badge variant="secondary">نشط</Badge>
        ) : (
          <Badge variant="outline">غير نشط</Badge>
        )}
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
        {passage.text}
      </p>
    </div>
  );
}
