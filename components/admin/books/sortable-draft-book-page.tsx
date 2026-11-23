"use client";

import * as React from "react";
import { GripVertical, Plus, Scissors, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { DraftBookPage } from "./book-text-draft-storage";

export function SortableDraftBookPage({ page, index, hasNext, group, isBusy, onTextChange, onSplit, onMergePrevious, onMergeNext, onRemove }: { page: DraftBookPage; index: number; hasNext: boolean; group: string; isBusy: boolean; onTextChange: (id: string, text: string) => void; onSplit: (id: string, position: number | null) => void; onMergePrevious: (id: string) => void; onMergeNext: (id: string) => void; onRemove: (id: string) => void }) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const selectionRef = React.useRef<number | null>(null);
  const { handleRef, isDragging, isDropTarget, ref } = useSortable({ id: page.tempId, index, group });
  const capture = () => { selectionRef.current = textareaRef.current?.selectionStart ?? null; };
  return <li ref={ref} className={cn("space-y-3 rounded-xl border bg-background p-3 sm:p-4", isDragging && "opacity-50", isDropTarget && "ring-1 ring-primary/40")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><button ref={handleRef} type="button" disabled={isBusy} aria-label={`سحب الصفحة ${index + 1} لإعادة الترتيب`} className="inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"><GripVertical className="size-4" /></button><h3 className="font-medium">الصفحة {index + 1}</h3></div><div className="flex flex-wrap gap-1.5">{index ? <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => onMergePrevious(page.tempId)}>دمج مع السابقة</Button> : null}<Button type="button" size="sm" variant="ghost" disabled={isBusy} onPointerDown={(event) => { event.preventDefault(); capture(); }} onClick={() => onSplit(page.tempId, selectionRef.current)}><Scissors />تقسيم عند المؤشر</Button>{hasNext ? <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => onMergeNext(page.tempId)}>دمج مع التالية</Button> : null}<Button type="button" size="icon-xs" variant="ghost" disabled={isBusy} onClick={() => onRemove(page.tempId)} aria-label="حذف الصفحة من المسودة"><Trash2 /></Button></div></div>
    <Textarea ref={textareaRef} value={page.text} rows={8} className="min-h-44 resize-y whitespace-pre-wrap leading-7" disabled={isBusy} onFocus={capture} onClick={capture} onKeyUp={capture} onSelect={capture} onChange={(event) => { capture(); onTextChange(page.tempId, event.target.value); }} aria-label={`نص الصفحة ${index + 1}`} />
  </li>;
}
