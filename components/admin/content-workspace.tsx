"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ListTree } from "lucide-react";
import { toast } from "sonner";

import { ArchiveContentDialog } from "@/components/admin/archive-content-dialog";
import {
  ContentFormDialog,
  type ContentEditor,
  type ContentEntity,
  type ContentFormValues,
} from "@/components/admin/content-form-dialog";
import {
  ContentColumn,
  type ContentListItem,
} from "@/components/admin/content-column";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  createLevel,
  createMatn,
  createScience,
  getFirestoreErrorMessage,
  listLevels,
  listMatn,
  listSciences,
  setLevelActive,
  setLevelArchived,
  setMatnActive,
  setMatnArchived,
  setScienceActive,
  setScienceArchived,
  updateLevel,
  updateMatn,
  updateScience,
} from "@/lib/firestore/content";
import type { Level, Matn, Science } from "@/types";
import { cn } from "@/lib/utils";

type ArchiveTarget = {
  entity: ContentEntity;
  item: ContentListItem;
};

export function ContentWorkspace() {
  const [levels, setLevels] = React.useState<Level[]>([]);
  const [sciences, setSciences] = React.useState<Science[]>([]);
  const [matn, setMatn] = React.useState<Matn[]>([]);
  const [selectedLevelId, setSelectedLevelId] = React.useState<string | null>(
    null
  );
  const [selectedScienceId, setSelectedScienceId] = React.useState<
    string | null
  >(null);
  const [levelsLoading, setLevelsLoading] = React.useState(true);
  const [sciencesLoading, setSciencesLoading] = React.useState(false);
  const [matnLoading, setMatnLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showArchivedLevels, setShowArchivedLevels] = React.useState(false);
  const [showArchivedSciences, setShowArchivedSciences] = React.useState(false);
  const [showArchivedMatn, setShowArchivedMatn] = React.useState(false);
  const [editor, setEditor] = React.useState<ContentEditor | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<ArchiveTarget | null>(
    null
  );
  const sciencesRequest = React.useRef(0);
  const matnRequest = React.useRef(0);

  const selectedLevel = levels.find((item) => item.id === selectedLevelId) ?? null;
  const selectedScience =
    sciences.find((item) => item.id === selectedScienceId) ?? null;

  const reportError = React.useCallback((error: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Firestore content operation failed.", error);
    }

    toast.error(getFirestoreErrorMessage(error));
  }, []);

  const loadLevels = React.useCallback(async () => {
    setLevelsLoading(true);

    try {
      setLevels(await listLevels());
    } catch (error) {
      reportError(error);
    } finally {
      setLevelsLoading(false);
    }
  }, [reportError]);

  const loadSciences = React.useCallback(
    async (levelId: string) => {
      const requestId = ++sciencesRequest.current;
      setSciencesLoading(true);

      try {
        const nextSciences = await listSciences(levelId);

        if (requestId === sciencesRequest.current) {
          setSciences(nextSciences);
        }
      } catch (error) {
        if (requestId === sciencesRequest.current) {
          reportError(error);
        }
      } finally {
        if (requestId === sciencesRequest.current) {
          setSciencesLoading(false);
        }
      }
    },
    [reportError]
  );

  const loadMatn = React.useCallback(
    async (scienceId: string) => {
      const requestId = ++matnRequest.current;
      setMatnLoading(true);

      try {
        const nextMatn = await listMatn(scienceId);

        if (requestId === matnRequest.current) {
          setMatn(nextMatn);
        }
      } catch (error) {
        if (requestId === matnRequest.current) {
          reportError(error);
        }
      } finally {
        if (requestId === matnRequest.current) {
          setMatnLoading(false);
        }
      }
    },
    [reportError]
  );

  React.useEffect(() => {
    void loadLevels();
  }, [loadLevels]);

  function selectLevel(level: ContentListItem) {
    setSelectedLevelId(level.id);
    setSelectedScienceId(null);
    setSciences([]);
    setMatn([]);
    sciencesRequest.current += 1;
    matnRequest.current += 1;
    setMatnLoading(false);
    void loadSciences(level.id);
  }

  function selectScience(science: ContentListItem) {
    setSelectedScienceId(science.id);
    setMatn([]);
    void loadMatn(science.id);
  }

  function openCreateEditor(entity: ContentEntity) {
    if (entity === "science" && !selectedLevel) {
      toast.error("اختر مستوى أولًا.");
      return;
    }

    if (entity === "matn" && (!selectedLevel || !selectedScience)) {
      toast.error("اختر مستوى وعلمًا أولًا.");
      return;
    }

    setEditor({ entity });
  }

  function openEditEditor(entity: ContentEntity, item: ContentListItem) {
    setEditor({ entity, item: item as Level | Science | Matn });
  }

  async function handleFormSubmit(values: ContentFormValues) {
    if (!editor) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { entity, item } = editor;

      if (entity === "level") {
        if (item) {
          await updateLevel(item.id, values);
          await loadLevels();
          toast.success("تم تحديث المستوى.");
        } else {
          const levelId = await createLevel(values);
          await loadLevels();
          setSelectedLevelId(levelId);
          setSelectedScienceId(null);
          setSciences([]);
          setMatn([]);
          sciencesRequest.current += 1;
          matnRequest.current += 1;
          toast.success("تم إنشاء المستوى.");
        }
      }

      if (entity === "science") {
        if (!selectedLevel) {
          toast.error("اختر مستوى أولًا.");
          return;
        }

        if (item) {
          await updateScience(item.id, values);
          await loadSciences(selectedLevel.id);
          toast.success("تم تحديث العلم.");
        } else {
          const scienceId = await createScience(selectedLevel.id, values);
          await loadSciences(selectedLevel.id);
          setSelectedScienceId(scienceId);
          setMatn([]);
          toast.success("تم إنشاء العلم.");
        }
      }

      if (entity === "matn") {
        if (!selectedLevel || !selectedScience) {
          toast.error("اختر مستوى وعلمًا أولًا.");
          return;
        }

        if (item) {
          await updateMatn(item.id, values);
          await loadMatn(selectedScience.id);
          toast.success("تم تحديث المتن.");
        } else {
          await createMatn(selectedLevel.id, selectedScience.id, values);
          await loadMatn(selectedScience.id);
          toast.success("تم إنشاء المتن.");
        }
      }

      setEditor(null);
    } catch (error) {
      reportError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActiveChange(entity: ContentEntity, item: ContentListItem) {
    setIsSubmitting(true);

    try {
      const isActive = !item.isActive;

      if (entity === "level") {
        await setLevelActive(item.id, isActive);
        await loadLevels();
      }

      if (entity === "science" && selectedLevel) {
        await setScienceActive(item.id, isActive);
        await loadSciences(selectedLevel.id);
      }

      if (entity === "matn" && selectedScience) {
        await setMatnActive(item.id, isActive);
        await loadMatn(selectedScience.id);
      }

      toast.success(isActive ? "تم تفعيل العنصر." : "تم إيقاف العنصر.");
    } catch (error) {
      reportError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { entity, item } = archiveTarget;
      const nextArchivedState = !item.isArchived;

      if (entity === "level") {
        await setLevelArchived(item.id, nextArchivedState);
        await loadLevels();

        if (selectedLevelId === item.id && nextArchivedState) {
          setSelectedLevelId(null);
          setSelectedScienceId(null);
          setSciences([]);
          setMatn([]);
          sciencesRequest.current += 1;
          matnRequest.current += 1;
        }
      }

      if (entity === "science" && selectedLevel) {
        await setScienceArchived(item.id, nextArchivedState);
        await loadSciences(selectedLevel.id);

        if (selectedScienceId === item.id && nextArchivedState) {
          setSelectedScienceId(null);
          setMatn([]);
          matnRequest.current += 1;
        }
      }

      if (entity === "matn" && selectedScience) {
        await setMatnArchived(item.id, nextArchivedState);
        await loadMatn(selectedScience.id);
      }

      toast.success(nextArchivedState ? "تمت أرشفة العنصر." : "تمت استعادة العنصر.");
      setArchiveTarget(null);
    } catch (error) {
      reportError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <span>المسار:</span>
        <span>المستويات</span>
        {selectedLevel ? (
          <>
            <ChevronLeft className="size-4 rtl:rotate-180" />
            <Badge variant="secondary">{selectedLevel.name}</Badge>
          </>
        ) : null}
        {selectedScience ? (
          <>
            <ChevronLeft className="size-4 rtl:rotate-180" />
            <Badge variant="secondary">{selectedScience.name}</Badge>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ContentColumn
          title="المستويات"
          description="نقطة البداية لتنظيم المحتوى العلمي."
          createLabel="إضافة"
          emptyMessage="لا توجد مستويات بعد."
          items={levels}
          selectedItemId={selectedLevelId}
          isLoading={levelsLoading}
          isBusy={isSubmitting}
          showArchived={showArchivedLevels}
          onShowArchivedChange={setShowArchivedLevels}
          onCreate={() => openCreateEditor("level")}
          onSelect={selectLevel}
          onEdit={(item) => openEditEditor("level", item)}
          onSetArchived={(item) =>
            setArchiveTarget({ entity: "level", item })
          }
          onSetActive={(item) => void handleActiveChange("level", item)}
        />

        <ContentColumn
          title="العلوم"
          description={
            selectedLevel
              ? `العلوم التابعة لمستوى «${selectedLevel.name}».`
              : "اختر مستوى لعرض العلوم التابعة له."
          }
          createLabel="إضافة"
          emptyMessage={
            selectedLevel ? "لا توجد علوم في هذا المستوى." : "اختر مستوى أولًا."
          }
          items={sciences}
          selectedItemId={selectedScienceId}
          isLoading={sciencesLoading}
          isDisabled={!selectedLevel}
          isBusy={isSubmitting}
          showArchived={showArchivedSciences}
          onShowArchivedChange={setShowArchivedSciences}
          onCreate={() => openCreateEditor("science")}
          onSelect={selectScience}
          onEdit={(item) => openEditEditor("science", item)}
          onSetArchived={(item) =>
            setArchiveTarget({ entity: "science", item })
          }
          onSetActive={(item) => void handleActiveChange("science", item)}
        />

        <ContentColumn
          title="المتون"
          description={
            selectedScience
              ? `المتون التابعة لعلم «${selectedScience.name}».`
              : "اختر علمًا لعرض المتون التابعة له."
          }
          createLabel="إضافة"
          emptyMessage={
            selectedScience ? "لا توجد متون في هذا العلم." : "اختر علمًا أولًا."
          }
          items={matn}
          selectedItemId={null}
          isLoading={matnLoading}
          isDisabled={!selectedScience}
          isBusy={isSubmitting}
          showArchived={showArchivedMatn}
          onShowArchivedChange={setShowArchivedMatn}
          onCreate={() => openCreateEditor("matn")}
          renderItemActions={(item) => (
            <Link
              href={`/admin/matn/${item.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "shrink-0"
              )}
            >
              <ListTree />
              <span>إدارة البنية</span>
            </Link>
          )}
          onEdit={(item) => openEditEditor("matn", item)}
          onSetArchived={(item) => setArchiveTarget({ entity: "matn", item })}
          onSetActive={(item) => void handleActiveChange("matn", item)}
        />
      </div>

      <ContentFormDialog
        editor={editor}
        isSubmitting={isSubmitting}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setEditor(null);
          }
        }}
        onSubmit={(values) => void handleFormSubmit(values)}
      />

      <ArchiveContentDialog
        itemName={archiveTarget?.item.name ?? null}
        isArchived={archiveTarget?.item.isArchived ?? false}
        isSubmitting={isSubmitting}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setArchiveTarget(null);
          }
        }}
        onConfirm={() => void handleArchiveConfirm()}
      />
    </div>
  );
}
