"use client";

import type { ReactNode } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Power } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type ContentListItem = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  isArchived: boolean;
};

type ContentColumnProps = {
  title: string;
  description: string;
  createLabel: string;
  emptyMessage: string;
  items: readonly ContentListItem[];
  selectedItemId: string | null;
  isLoading: boolean;
  isDisabled?: boolean;
  isBusy?: boolean;
  showArchived: boolean;
  onShowArchivedChange: (showArchived: boolean) => void;
  onCreate: () => void;
  onSelect?: (item: ContentListItem) => void;
  renderItemActions?: (item: ContentListItem) => ReactNode;
  onEdit: (item: ContentListItem) => void;
  onSetArchived: (item: ContentListItem) => void;
  onSetActive: (item: ContentListItem) => void;
};

export function ContentColumn({
  title,
  description,
  createLabel,
  emptyMessage,
  items,
  selectedItemId,
  isLoading,
  isDisabled = false,
  isBusy = false,
  showArchived,
  onShowArchivedChange,
  onCreate,
  onSelect,
  renderItemActions,
  onEdit,
  onSetArchived,
  onSetActive,
}: ContentColumnProps) {
  const visibleItems = showArchived
    ? items
    : items.filter((item) => !item.isArchived);

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
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
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
            onCheckedChange={onShowArchivedChange}
            disabled={isDisabled || isBusy}
            aria-label="إظهار العناصر المؤرشفة"
          />
          إظهار المؤرشفة
        </label>
      </div>

      <div className="flex-1 space-y-1 p-2">
        {isLoading ? (
          <p className="p-3 text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : isDisabled ? (
          <p className="p-3 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </p>
        ) : visibleItems.length === 0 ? (
          <p className="p-3 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          visibleItems.map((item) => {
            const isSelected = item.id === selectedItemId;
            const itemDetails = (
              <>
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  {item.isArchived ? (
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

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-1 rounded-lg p-1 transition-colors",
                  isSelected && "bg-accent"
                )}
              >
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    disabled={isBusy}
                    className="min-w-0 flex-1 rounded-md px-2 py-2 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                    aria-pressed={isSelected}
                  >
                    {itemDetails}
                  </button>
                ) : (
                  <div className="min-w-0 flex-1 px-2 py-2">{itemDetails}</div>
                )}

                <div className="flex shrink-0 items-center gap-0.5">
                  {renderItemActions?.(item)}

                  {!item.isArchived ? (
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
                  ) : null}

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
                    aria-label={item.isArchived ? "استعادة العنصر" : "أرشفة العنصر"}
                    title={item.isArchived ? "استعادة" : "أرشفة"}
                  >
                    {item.isArchived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
