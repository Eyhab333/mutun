"use client";

import * as React from "react";
import { GripVertical, Scissors } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { DraftPassage } from "./prose-draft-storage";

type SortableDraftPassageProps = {
  passage: DraftPassage;
  index: number;
  itemLabel: string;
  hasNext: boolean;
  group: string;
  isBusy: boolean;
  onTextChange: (tempId: string, text: string) => void;
  onSplit: (tempId: string, selectionStart: number | null) => void;
  onMergePrevious: (tempId: string) => void;
  onMergeNext: (tempId: string) => void;
};

export function SortableDraftPassage({
  passage,
  index,
  itemLabel,
  hasNext,
  group,
  isBusy,
  onTextChange,
  onSplit,
  onMergePrevious,
  onMergeNext,
}: SortableDraftPassageProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const selectionStartRef = React.useRef<number | null>(null);
  const { handleRef, isDragging, isDropTarget, ref } = useSortable({
    id: passage.tempId,
    index,
    group,
  });

  function captureSelection() {
    selectionStartRef.current = textareaRef.current?.selectionStart ?? null;
  }

  function handleSplitClick() {
    captureSelection();
    onSplit(passage.tempId, selectionStartRef.current);
  }

  return (
    <li
      ref={ref}
      className={cn(
        "space-y-3 rounded-xl border bg-background p-3 sm:p-4",
        isDropTarget && "ring-1 ring-primary/40",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            ref={handleRef}
            type="button"
            className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`سحب ${itemLabel} ${index + 1} لإعادة الترتيب`}
            title="سحب لإعادة الترتيب"
            disabled={isBusy}
          >
            <GripVertical className="size-4" />
          </button>
          <h3 className="font-medium">{itemLabel} {index + 1}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {index > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMergePrevious(passage.tempId)}
              disabled={isBusy}
            >
              دمج مع السابق
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPointerDown={(event) => {
              event.preventDefault();
              captureSelection();
            }}
            onClick={handleSplitClick}
            disabled={isBusy}
          >
            <Scissors />
            تقسيم عند المؤشر
          </Button>
          {hasNext ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMergeNext(passage.tempId)}
              disabled={isBusy}
            >
              دمج مع التالي
            </Button>
          ) : null}
        </div>
      </div>

      <Textarea
        ref={textareaRef}
        value={passage.text}
        rows={7}
        className="min-h-40 resize-y whitespace-pre-wrap leading-7"
        onFocus={captureSelection}
        onClick={captureSelection}
        onKeyUp={captureSelection}
        onSelect={captureSelection}
        onChange={(event) => {
          captureSelection();
          onTextChange(passage.tempId, event.target.value);
        }}
        disabled={isBusy}
        aria-label={`نص ${itemLabel} ${index + 1}`}
      />
    </li>
  );
}
