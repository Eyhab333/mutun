"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { ArrowRight, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { ArchiveContentDialog } from "@/components/admin/archive-content-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import {
  createPassageResource,
  listPassageResources,
  reorderPassageResources,
  setPassageResourceActive,
  setPassageResourceArchived,
  updatePassageResource,
  type PassageResourceInput,
} from "@/lib/firestore/passage-resources";
import { cn } from "@/lib/utils";
import type { Passage, PassageResource } from "@/types";

import {
  PassageResourceForm,
  type PassageResourceEditor,
} from "./passage-resource-form";
import {
  ArchivedPassageResourceItem,
  SortablePassageResourceItem,
} from "./sortable-passage-resource-item";
import { useSortableItems } from "./use-sortable-items";

type PassageResourcesDialogProps = {
  passage: Passage | null;
  onOpenChange: (open: boolean) => void;
};

function getResourceName(resource: PassageResource): string {
  if (resource.title) {
    return resource.title;
  }

  switch (resource.type) {
    case "NOTE":
      return "ملاحظة";
    case "YOUTUBE":
      return "مورد YouTube";
    case "IMAGE":
      return "صورة";
    case "AUDIO":
      return "ملف صوتي";
  }

  return "مورد تعليمي";
}

export function PassageResourcesDialog({
  passage,
  onOpenChange,
}: PassageResourcesDialogProps) {
  const [resources, setResources] = React.useState<PassageResource[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [editor, setEditor] = React.useState<PassageResourceEditor | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<PassageResource | null>(
    null
  );
  const loadRequestRef = React.useRef(0);
  const formSubmissionRef = React.useRef(false);
  const passageId = passage?.id ?? null;

  const reportError = React.useCallback((error: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Passage resource operation failed.", error);
    }

    toast.error(getFirestoreErrorMessage(error));
  }, []);

  const loadResources = React.useCallback(
    async (id: string) => {
      const requestId = ++loadRequestRef.current;
      setIsLoading(true);

      try {
        const nextResources = await listPassageResources(id);

        if (requestId === loadRequestRef.current) {
          setResources(nextResources);
        }
      } catch (error) {
        if (requestId === loadRequestRef.current) {
          reportError(error);
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [reportError]
  );

  React.useEffect(() => {
    setEditor(null);
    setArchiveTarget(null);
    setShowArchived(false);

    if (!passageId) {
      loadRequestRef.current += 1;
      setResources([]);
      setIsLoading(false);
      return;
    }

    void loadResources(passageId);
  }, [passageId, loadResources]);

  const { archivedItems, handleDragEnd, orderedItems } = useSortableItems(
    resources,
    isMutating,
    (items) => void handleReorder(items)
  );

  async function handleFormSubmit(values: PassageResourceInput) {
    if (!passageId || !editor || formSubmissionRef.current) {
      return;
    }

    formSubmissionRef.current = true;
    setIsMutating(true);

    try {
      if (editor.item) {
        await updatePassageResource(editor.item, values);
        toast.success("تم تحديث المورد.");
      } else {
        await createPassageResource(passageId, values);
        toast.success("تمت إضافة المورد.");
      }

      await loadResources(passageId);
      setEditor(null);
    } catch (error) {
      reportError(error);
    } finally {
      formSubmissionRef.current = false;
      setIsMutating(false);
    }
  }

  async function handleSetActive(resource: PassageResource) {
    if (!passageId) {
      return;
    }

    setIsMutating(true);

    try {
      const isActive = !resource.isActive;
      await setPassageResourceActive(resource.id, isActive);
      await loadResources(passageId);
      toast.success(isActive ? "تم تفعيل المورد." : "تم إيقاف المورد.");
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleArchiveConfirm() {
    if (!passageId || !archiveTarget) {
      return;
    }

    setIsMutating(true);

    try {
      const isArchived = !archiveTarget.isArchived;
      await setPassageResourceArchived(archiveTarget.id, passageId, isArchived);
      await loadResources(passageId);
      toast.success(isArchived ? "تمت أرشفة المورد." : "تمت استعادة المورد.");
      setArchiveTarget(null);
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleReorder(items: readonly PassageResource[]) {
    if (!passageId) {
      return;
    }

    setIsMutating(true);

    try {
      const changed = await reorderPassageResources(passageId, items);

      if (changed) {
        toast.success("تم تحديث ترتيب الموارد.");
      }
    } catch (error) {
      reportError(error);
      await loadResources(passageId);
    } finally {
      setIsMutating(false);
    }
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open && !isMutating) {
      setEditor(null);
      setArchiveTarget(null);
      onOpenChange(false);
    }
  }

  return (
    <>
      <Dialog open={Boolean(passage)} onOpenChange={handleDialogOpenChange}>
        <DialogContent
        showCloseButton={!isMutating}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        >
        <DialogHeader>
          <DialogTitle>{editor ? "تعديل المورد" : "موارد المقطع"}</DialogTitle>
          <DialogDescription>
            {editor
              ? "أدخل بيانات المورد التعليمية وحدد حالته."
              : passage
                ? `إدارة الموارد التعليمية المرتبطة بهذا المقطع: ${passage.text.slice(0, 80)}`
                : ""}
          </DialogDescription>
        </DialogHeader>

        {editor ? (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditor(null)}
              disabled={isMutating}
            >
              <ArrowRight className="rtl:rotate-180" />
              العودة إلى الموارد
            </Button>
            <PassageResourceForm
              editor={editor}
              isSubmitting={isMutating}
              onCancel={() => setEditor(null)}
              onSubmit={(values) => void handleFormSubmit(values)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  size="sm"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                  disabled={isMutating || isLoading}
                  aria-label="إظهار الموارد المؤرشفة"
                />
                إظهار المؤرشف
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => setEditor({})}
                disabled={isMutating || isLoading}
              >
                <Plus />
                إضافة مورد
              </Button>
            </div>

            <div
              className={cn(
                "rounded-xl border p-2",
                isLoading && "min-h-28"
              )}
            >
              {isLoading ? (
                <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  جارٍ تحميل الموارد...
                </div>
              ) : showArchived ? (
                archivedItems.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    لا توجد موارد مؤرشفة.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {archivedItems.map((resource) => (
                      <ArchivedPassageResourceItem
                        key={resource.id}
                        resource={resource}
                        isBusy={isMutating}
                        onEdit={(item) => setEditor({ item })}
                        onSetArchived={setArchiveTarget}
                      />
                    ))}
                  </ul>
                )
              ) : orderedItems.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  لا توجد موارد لهذا المقطع بعد.
                </p>
              ) : (
                <DragDropProvider onDragEnd={handleDragEnd}>
                  <ul className="space-y-2">
                    {orderedItems.map((resource, index) => (
                      <SortablePassageResourceItem
                        key={resource.id}
                        resource={resource}
                        index={index}
                        group={`passage-resources-${passageId}`}
                        isBusy={isMutating}
                        onEdit={(item) => setEditor({ item })}
                        onSetActive={(item) => void handleSetActive(item)}
                        onSetArchived={setArchiveTarget}
                      />
                    ))}
                  </ul>
                </DragDropProvider>
              )}
            </div>
          </div>
        )}
        </DialogContent>

      </Dialog>

      <ArchiveContentDialog
        itemName={archiveTarget ? getResourceName(archiveTarget) : null}
        isArchived={archiveTarget?.isArchived ?? false}
        isSubmitting={isMutating}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setArchiveTarget(null);
          }
        }}
        onConfirm={() => void handleArchiveConfirm()}
      />
    </>
  );
}
