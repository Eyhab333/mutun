"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { FileText, LoaderCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PassageParent } from "@/lib/firestore/matn-structure";

import {
  createDraftPassage,
  createPassageDraftStorageKey,
  readPassageDraft,
  removePassageDraft,
  savePassageDraft,
  type DraftPassage,
  type PassageImportMode,
} from "./prose-draft-storage";
import { SortableDraftPassage } from "./sortable-draft-passage";
import { useSortableItems } from "./use-sortable-items";

type PassageImportEditorProps = {
  mode: PassageImportMode;
  matnName: string;
  contextLabel: string;
  parent: PassageParent;
  isSaving: boolean;
  onExit: () => void;
  onSave: (draftPassages: readonly DraftPassage[]) => Promise<boolean>;
};

type Stage = "input" | "recovery" | "split";
type ClearIntent = "new" | "delete" | null;

type SortableDraftPassageData = DraftPassage & {
  id: string;
  order: number;
  isArchived: false;
};

function createInitialDraftTexts(mode: PassageImportMode, sourceText: string) {
  if (mode === "PROSE") {
    const trimmedText = sourceText.trim();

    return trimmedText ? [trimmedText] : [];
  }

  return sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeText(mode: PassageImportMode, first: string, second: string) {
  return mode === "POETRY"
    ? `${first.trimEnd()} ${second.trimStart()}`
    : `${first.trimEnd()}\n\n${second.trimStart()}`;
}

export function PassageImportEditor({
  mode,
  matnName,
  contextLabel,
  parent,
  isSaving,
  onExit,
  onSave,
}: PassageImportEditorProps) {
  const storageKey = React.useMemo(
    () => createPassageDraftStorageKey(mode, parent),
    [mode, parent.chapterId, parent.maqsadId, parent.matnId, parent.sectionId]
  );
  const [isDraftChecked, setIsDraftChecked] = React.useState(false);
  const [stage, setStage] = React.useState<Stage>("input");
  const [sourceText, setSourceText] = React.useState("");
  const [draftPassages, setDraftPassages] = React.useState<DraftPassage[]>([]);
  const [clearIntent, setClearIntent] = React.useState<ClearIntent>(null);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const keepDraftOnUnmount = React.useRef(true);
  const latestDraft = React.useRef<{
    sourceText: string;
    passages: DraftPassage[];
    shouldPersist: boolean;
  } | null>(null);

  React.useEffect(() => {
    const savedDraft = readPassageDraft(storageKey, parent, mode);

    if (savedDraft) {
      setSourceText(savedDraft.sourceText);
      setDraftPassages(savedDraft.draftPassages);
      setStage("recovery");
    }

    setIsDraftChecked(true);
  }, [mode, parent, storageKey]);

  React.useEffect(() => {
    const shouldPersist = isDraftChecked && stage === "split" && draftPassages.length > 0;
    latestDraft.current = { sourceText, passages: draftPassages, shouldPersist };

    if (!shouldPersist) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      savePassageDraft(storageKey, parent, mode, sourceText, draftPassages);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [draftPassages, isDraftChecked, mode, parent, sourceText, stage, storageKey]);

  React.useEffect(
    () => () => {
      const draft = latestDraft.current;

      if (keepDraftOnUnmount.current && draft?.shouldPersist) {
        savePassageDraft(storageKey, parent, mode, draft.sourceText, draft.passages);
      }
    },
    [mode, parent, storageKey]
  );

  const sortableDraftPassages = React.useMemo<SortableDraftPassageData[]>(
    () =>
      draftPassages.map((passage, index) => ({
        ...passage,
        id: passage.tempId,
        order: index + 1,
        isArchived: false,
      })),
    [draftPassages]
  );
  const isBusy = isSaving || isFinalizing;
  const { handleDragEnd, orderedItems } = useSortableItems(
    sortableDraftPassages,
    isBusy,
    (items) => {
      setDraftPassages(items.map(({ tempId, text }) => ({ tempId, text })));
    }
  );

  function startSplitting() {
    const initialTexts = createInitialDraftTexts(mode, sourceText);

    if (initialTexts.length === 0) {
      toast.error(mode === "POETRY" ? "أدخل النص الشعري أولًا." : "أدخل النص أولًا.");
      return;
    }

    setSourceText(mode === "PROSE" ? (initialTexts[0] ?? "") : sourceText);
    setDraftPassages(initialTexts.map((text) => createDraftPassage(text)));
    setStage("split");
  }

  function updateDraftPassage(tempId: string, text: string) {
    setDraftPassages((current) =>
      current.map((passage) =>
        passage.tempId === tempId ? { ...passage, text } : passage
      )
    );
  }

  function splitDraftPassage(tempId: string, selectionStart: number | null) {
    const passage = draftPassages.find((item) => item.tempId === tempId);

    if (
      !passage ||
      selectionStart === null ||
      selectionStart <= 0 ||
      selectionStart >= passage.text.length
    ) {
      toast.error("ضع المؤشر داخل النص في موضع التقسيم.");
      return;
    }

    const firstText = passage.text.slice(0, selectionStart).trim();
    const secondText = passage.text.slice(selectionStart).trim();

    if (!firstText || !secondText) {
      toast.error("ضع المؤشر داخل النص في موضع التقسيم.");
      return;
    }

    setDraftPassages((current) => {
      const index = current.findIndex((item) => item.tempId === tempId);

      if (index < 0) {
        return current;
      }

      const next = [...current];
      next.splice(
        index,
        1,
        { ...current[index], text: firstText },
        createDraftPassage(secondText)
      );

      return next;
    });
  }

  function mergeWithPrevious(tempId: string) {
    setDraftPassages((current) => {
      const index = current.findIndex((item) => item.tempId === tempId);

      if (index <= 0) {
        return current;
      }

      const next = [...current];
      const previous = next[index - 1];
      const currentPassage = next[index];
      next.splice(index - 1, 2, {
        ...previous,
        text: mergeText(mode, previous.text, currentPassage.text),
      });

      return next;
    });
  }

  function mergeWithNext(tempId: string) {
    setDraftPassages((current) => {
      const index = current.findIndex((item) => item.tempId === tempId);

      if (index < 0 || index === current.length - 1) {
        return current;
      }

      const next = [...current];
      const currentPassage = next[index];
      const following = next[index + 1];
      next.splice(index, 2, {
        ...currentPassage,
        text: mergeText(mode, currentPassage.text, following.text),
      });

      return next;
    });
  }

  async function saveDraftPassages() {
    const normalizedPassages = draftPassages.map((passage) => ({
      ...passage,
      text: passage.text.trim(),
    }));

    if (
      normalizedPassages.length === 0 ||
      normalizedPassages.some((passage) => !passage.text)
    ) {
      toast.error(
        mode === "POETRY"
          ? "أكمل نص كل بيت قبل الحفظ."
          : "أكمل نص كل مقطع قبل الحفظ."
      );
      return;
    }

    setIsFinalizing(true);

    try {
      const saved = await onSave(normalizedPassages);

      if (!saved) {
        return;
      }

      keepDraftOnUnmount.current = false;
      removePassageDraft(storageKey);
      onExit();
    } finally {
      setIsFinalizing(false);
    }
  }

  function confirmClearDraft() {
    keepDraftOnUnmount.current = false;
    removePassageDraft(storageKey);

    if (clearIntent === "new") {
      setSourceText("");
      setDraftPassages([]);
      setStage("input");
      keepDraftOnUnmount.current = true;
    } else {
      onExit();
    }

    setClearIntent(null);
  }

  if (!isDraftChecked) {
    return (
      <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        جارٍ فحص المسودة المحلية...
      </section>
    );
  }

  const isPoetry = mode === "POETRY";
  const itemLabel = isPoetry ? "البيت" : "المقطع";
  const editorTitle = isPoetry ? "إدخال أبيات وتقسيمها" : "إدخال نص وتقسيمه";
  const sourceLabel = isPoetry ? "النص الشعري" : "النص الكامل";
  const sourceHint = isPoetry
    ? "سيصبح كل سطر غير فارغ بيتًا كاملًا واحدًا، ويمكنك المراجعة والتعديل لاحقًا."
    : "سيبدأ النص كمقطع واحد، ثم تحدد مواضع التقسيم يدويًا عند المؤشر.";
  const sourcePlaceholder = isPoetry
    ? "ألصق أو اكتب بيتًا كاملًا في كل سطر؛ ستُهمل الأسطر الفارغة فقط."
    : "ألصق أو اكتب النص كاملًا هنا، ثم حدّد المقاطع يدويًا في الخطوة التالية.";
  const sourceFieldId = `${mode.toLowerCase()}-source-text`;
  const reviewTitle = isPoetry ? "مراجعة الأبيات" : "مراجعة المقاطع";
  const countLabel = isPoetry
    ? draftPassages.length === 1
      ? "بيت"
      : "أبيات"
    : draftPassages.length === 1
      ? "مقطع"
      : "مقاطع";

  return (
    <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{editorTitle}</p>
          <h2 className="text-xl font-semibold">{matnName}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{contextLabel}</p>
        </div>
        <Button type="button" variant="outline" onClick={onExit} disabled={isBusy}>
          {isPoetry ? "العودة إلى الأبيات" : "العودة إلى المقاطع"}
        </Button>
      </div>

      {stage === "recovery" ? (
        <div className="max-w-xl space-y-4 py-4">
          <div className="space-y-1">
            <h3 className="font-medium">توجد مسودة محفوظة</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              يمكنك استكمال آخر تقسيم محفوظ لهذا الموضع، أو بدء مسودة جديدة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setStage("split")}>
              استكمال المسودة
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearIntent("new")}
            >
              بدء مسودة جديدة
            </Button>
          </div>
        </div>
      ) : stage === "input" ? (
        <div className="mx-auto grid max-w-3xl gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor={sourceFieldId}>{sourceLabel}</Label>
            <p className="text-sm leading-6 text-muted-foreground">
              {sourceHint}
            </p>
            <Textarea
              id={sourceFieldId}
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              rows={16}
              className="min-h-72 resize-y whitespace-pre-wrap leading-7"
              placeholder={sourcePlaceholder}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onExit}>
              إلغاء
            </Button>
            <Button type="button" onClick={startSplitting}>
              بدء التقسيم
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">{reviewTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {draftPassages.length} {countLabel} في هذه الدفعة.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setClearIntent("delete")}
              disabled={isBusy}
            >
              <Trash2 />
              حذف المسودة
            </Button>
          </div>

          <DragDropProvider onDragEnd={handleDragEnd}>
            <ol className="mx-auto max-w-4xl space-y-3">
              {orderedItems.map((passage, index) => (
                <SortableDraftPassage
                  key={passage.tempId}
                  passage={passage}
                  index={index}
                  itemLabel={itemLabel}
                  hasNext={index < orderedItems.length - 1}
                  group={storageKey}
                  isBusy={isBusy}
                  onTextChange={updateDraftPassage}
                  onSplit={splitDraftPassage}
                  onMergePrevious={mergeWithPrevious}
                  onMergeNext={mergeWithNext}
                />
              ))}
            </ol>
          </DragDropProvider>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onExit} disabled={isBusy}>
              حفظ المسودة والخروج
            </Button>
            <Button type="button" onClick={() => void saveDraftPassages()} disabled={isBusy}>
              {isBusy ? <LoaderCircle className="animate-spin" /> : <Save />}
              {isPoetry ? "حفظ الأبيات" : "حفظ المقاطع"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={clearIntent !== null}
        onOpenChange={(open) => {
          if (!open && !isBusy) {
            setClearIntent(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <FileText />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {clearIntent === "new" ? "بدء مسودة جديدة" : "حذف المسودة"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف تقسيم النص المحفوظ محليًا لهذا الموضع فقط. لن يُحذف أي {isPoetry ? "بيت" : "مقطع"} محفوظ في Firestore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={confirmClearDraft}
              disabled={isBusy}
            >
              حذف المسودة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function ProseImportEditor(
  props: Omit<PassageImportEditorProps, "mode">
) {
  return <PassageImportEditor {...props} mode="PROSE" />;
}
