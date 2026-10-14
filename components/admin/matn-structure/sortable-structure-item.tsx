"use client";

import { Archive, ArchiveRestore, GripVertical, Pencil, Power } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { StructureListItem } from "./structure-form-dialog";

type SortableStructureItemProps = {
  item: StructureListItem;
  index: number;
  group: string;
  isSelected: boolean;
  isBusy: boolean;
  onSelect?: (item: StructureListItem) => void;
  onEdit: (item: StructureListItem) => void;
  onSetActive: (item: StructureListItem) => void;
  onSetArchived: (item: StructureListItem) => void;
};

export function SortableStructureItem({
  item,
  index,
  group,
  isSelected,
  isBusy,
  onSelect,
  onEdit,
  onSetActive,
  onSetArchived,
}: SortableStructureItemProps) {
  const { handleRef, isDragging, isDropTarget, ref } = useSortable({
    id: item.id,
    index,
    group,
  });

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-center gap-1 rounded-lg p-1 transition-colors",
        isSelected && "bg-accent",
        isDropTarget && "ring-1 ring-primary/40",
        isDragging && "opacity-50"
      )}
    >
      <button
        ref={handleRef}
        type="button"
        className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`سحب ${item.title} لإعادة الترتيب`}
        title="سحب لإعادة الترتيب"
        disabled={isBusy}
      >
        <GripVertical className="size-4" />
      </button>

      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(item)}
          disabled={isBusy}
          className="min-w-0 flex-1 rounded-md px-2 py-2 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          aria-pressed={isSelected}
        >
          <StructureItemDetails item={item} />
        </button>
      ) : (
        <div className="min-w-0 flex-1 px-2 py-2">
          <StructureItemDetails item={item} />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetActive(item)}
          disabled={isBusy}
          aria-label={item.isActive ? "إيقاف العنصر" : "تفعيل العنصر"}
          title={item.isActive ? "إيقاف" : "تفعيل"}
        >
          <Power />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(item)}
          disabled={isBusy}
          aria-label="تعديل العنصر"
          title="تعديل"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetArchived(item)}
          disabled={isBusy}
          aria-label="أرشفة العنصر"
          title="أرشفة"
        >
          <Archive />
        </Button>
      </div>
    </li>
  );
}

type ArchivedStructureItemProps = Omit<SortableStructureItemProps, "index" | "group">;

export function ArchivedStructureItem({
  item,
  isBusy,
  onEdit,
  onSetArchived,
}: ArchivedStructureItemProps) {
  return (
    <li className="flex items-center gap-1 rounded-lg p-1">
      <div className="min-w-0 flex-1 px-2 py-2">
        <StructureItemDetails item={item} archived />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(item)}
          disabled={isBusy}
          aria-label="تعديل العنصر"
          title="تعديل"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetArchived(item)}
          disabled={isBusy}
          aria-label="استعادة العنصر"
          title="استعادة"
        >
          <ArchiveRestore />
        </Button>
      </div>
    </li>
  );
}

function StructureItemDetails({
  item,
  archived = false,
}: {
  item: StructureListItem;
  archived?: boolean;
}) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-medium">{item.title}</span>
        {archived ? (
          <Badge variant="secondary">مؤرشف</Badge>
        ) : item.isActive ? null : (
          <Badge variant="outline">غير نشط</Badge>
        )}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        الترتيب: {item.order}
      </span>
    </>
  );
}
