"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Passage } from "@/types";

import {
  ArchivedPassageItem,
  SortablePassageItem,
} from "./sortable-passage-item";
import { useSortableItems } from "./use-sortable-items";

type PassageListProps = {
  description: string;
  emptyMessage: string;
  group: string;
  items: readonly Passage[];
  isDisabled?: boolean;
  isBusy?: boolean;
  isLoading: boolean;
  onCreate: () => void;
  textImportAction?: {
    label: string;
    onClick: () => void;
  };
  onEdit: (passage: Passage) => void;
  onManageResources: (passage: Passage) => void;
  onReorder: (items: readonly Passage[]) => void;
  onSetActive: (passage: Passage) => void;
  onSetArchived: (passage: Passage) => void;
};

export function PassageList({
  description,
  emptyMessage,
  group,
  items,
  isDisabled = false,
  isBusy = false,
  isLoading,
  onCreate,
  textImportAction,
  onEdit,
  onManageResources,
  onReorder,
  onSetActive,
  onSetArchived,
}: PassageListProps) {
  const [showArchived, setShowArchived] = React.useState(false);
  const { archivedItems, handleDragEnd, orderedItems } = useSortableItems(
    items,
    isBusy,
    onReorder
  );

  return (
    <section
      className={cn(
        "flex min-h-80 flex-col rounded-xl border bg-card",
        isDisabled && "bg-muted/20"
      )}
      aria-disabled={isDisabled || undefined}
    >
      <div className="space-y-3 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground">المقاطع</h2>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {textImportAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={textImportAction.onClick}
                disabled={isDisabled || isBusy}
              >
                {textImportAction.label}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={onCreate}
              disabled={isDisabled || isBusy}
            >
              <Plus />
              إضافة مقطع
            </Button>
          </div>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch
            size="sm"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            disabled={isDisabled || isBusy}
            aria-label="إظهار المقاطع المؤرشفة"
          />
          إظهار المؤرشف
        </label>
      </div>

      <div className="flex-1 p-2">
        {isLoading ? (
          <p className="p-3 text-sm text-muted-foreground">جارٍ تحميل المقاطع...</p>
        ) : isDisabled ? (
          <p className="p-3 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
        ) : showArchived ? (
          archivedItems.length === 0 ? (
            <p className="p-3 text-sm leading-6 text-muted-foreground">
              لا توجد مقاطع مؤرشفة.
            </p>
          ) : (
            <ul className="space-y-2">
              {archivedItems.map((passage) => (
                <ArchivedPassageItem
                  key={passage.id}
                  passage={passage}
                  isBusy={isBusy}
                  onEdit={onEdit}
                  onManageResources={onManageResources}
                  onSetArchived={onSetArchived}
                />
              ))}
            </ul>
          )
        ) : orderedItems.length === 0 ? (
          <p className="p-3 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
        ) : (
          <DragDropProvider onDragEnd={handleDragEnd}>
            <ul className="space-y-2">
              {orderedItems.map((passage, index) => (
                <SortablePassageItem
                  key={passage.id}
                  passage={passage}
                  index={index}
                  group={group}
                  isBusy={isBusy}
                  onEdit={onEdit}
                  onManageResources={onManageResources}
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
