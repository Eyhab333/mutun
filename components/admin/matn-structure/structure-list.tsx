"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  ArchivedStructureItem,
  SortableStructureItem,
} from "./sortable-structure-item";
import type { StructureListItem } from "./structure-form-dialog";
import { useSortableItems } from "./use-sortable-items";

type StructureListProps = {
  title: string;
  description: string;
  createLabel: string;
  emptyMessage: string;
  items: readonly StructureListItem[];
  group: string;
  selectedItemId?: string | null;
  isLoading: boolean;
  isDisabled?: boolean;
  isBusy?: boolean;
  onCreate: () => void;
  onSelect?: (item: StructureListItem) => void;
  onEdit: (item: StructureListItem) => void;
  onSetActive: (item: StructureListItem) => void;
  onSetArchived: (item: StructureListItem) => void;
  onReorder: (items: readonly StructureListItem[]) => void;
};

export function StructureList({
  title,
  description,
  createLabel,
  emptyMessage,
  items,
  group,
  selectedItemId = null,
  isLoading,
  isDisabled = false,
  isBusy = false,
  onCreate,
  onSelect,
  onEdit,
  onSetActive,
  onSetArchived,
  onReorder,
}: StructureListProps) {
  const [showArchived, setShowArchived] = React.useState(false);
  const { archivedItems, handleDragEnd, orderedItems } = useSortableItems(
    items,
    isBusy,
    onReorder
  );

  return (
    <section
      className={cn(
        "flex min-h-72 flex-col rounded-xl border bg-card",
        isDisabled && "bg-muted/20"
      )}
      aria-disabled={isDisabled || undefined}
    >
      <div className="space-y-3 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            disabled={isDisabled || isBusy}
          >
            <Plus />
            {createLabel}
          </Button>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch
            size="sm"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            disabled={isDisabled || isBusy}
            aria-label="إظهار العناصر المؤرشفة"
          />
          إظهار المؤرشف
        </label>
      </div>

      <div className="flex-1 p-2">
        {isLoading ? (
          <p className="p-3 text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : isDisabled ? (
          <p className="p-3 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
        ) : showArchived ? (
          archivedItems.length === 0 ? (
            <p className="p-3 text-sm leading-6 text-muted-foreground">
              لا توجد عناصر مؤرشفة.
            </p>
          ) : (
            <ul className="space-y-1">
              {archivedItems.map((item) => (
                <ArchivedStructureItem
                  key={item.id}
                  item={item}
                  isSelected={false}
                  isBusy={isBusy}
                  onEdit={onEdit}
                  onSetActive={onSetActive}
                  onSetArchived={onSetArchived}
                />
              ))}
            </ul>
          )
        ) : orderedItems.length === 0 ? (
          <p className="p-3 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
        ) : (
          <DragDropProvider onDragEnd={handleDragEnd}>
            <ul className="space-y-1">
              {orderedItems.map((item, index) => (
                <SortableStructureItem
                  key={item.id}
                  item={item}
                  index={index}
                  group={group}
                  isSelected={item.id === selectedItemId}
                  isBusy={isBusy}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onSetActive={onSetActive}
                  onSetArchived={onSetArchived}
                />
              ))}
            </ul>
          </DragDropProvider>
        )}
      </div>
    </section>
  );
}
