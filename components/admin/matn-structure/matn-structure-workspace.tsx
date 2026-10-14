"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { ArchiveContentDialog } from "@/components/admin/archive-content-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  createChapter,
  createMaqsad,
  createPassage,
  createSection,
  appendPassages,
  getMatnStructureContext,
  listChapters,
  listMaqasid,
  listPassages,
  listSections,
  reorderChapters,
  reorderMaqasid,
  reorderPassages,
  reorderSections,
  setChapterActive,
  setChapterArchived,
  setMaqsadActive,
  setMaqsadArchived,
  setPassageActive,
  setPassageArchived,
  setSectionActive,
  setSectionArchived,
  updateChapter,
  updateMaqsad,
  updatePassage,
  updateSection,
  type ChapterParent,
  type MatnStructureContext,
  type PassageInput,
  type PassageParent,
  type SectionParent,
  type StructureInput,
} from "@/lib/firestore/matn-structure";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import { cn } from "@/lib/utils";
import type { Chapter, Maqsad, Passage, Section } from "@/types";

import {
  StructureFormDialog,
  type StructureEditor,
  type StructureEntity,
  type StructureListItem,
} from "./structure-form-dialog";
import { StructureList } from "./structure-list";
import {
  PassageFormDialog,
  type PassageEditor,
} from "./passage-form-dialog";
import { PassageList } from "./passage-list";
import { PassageResourcesDialog } from "./passage-resources-dialog";
import { PassageImportEditor } from "./prose-import-editor";
import type {
  DraftPassage,
  PassageImportMode,
} from "./prose-draft-storage";

type ArchiveTarget =
  | { entity: StructureEntity; item: StructureListItem }
  | { entity: "passage"; item: Passage };

type PassageImportSession = {
  mode: PassageImportMode;
  parent: PassageParent;
};

export function MatnStructureWorkspace() {
  const { matnId } = useParams<{ matnId: string }>();
  const [context, setContext] = React.useState<MatnStructureContext | null>(null);
  const [maqasid, setMaqasid] = React.useState<Maqsad[]>([]);
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [passages, setPassages] = React.useState<Passage[]>([]);
  const [selectedMaqsadId, setSelectedMaqsadId] = React.useState<string | null>(
    null
  );
  const [selectedChapterId, setSelectedChapterId] = React.useState<string | null>(
    null
  );
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(
    null
  );
  const [contextLoading, setContextLoading] = React.useState(true);
  const [maqasidLoading, setMaqasidLoading] = React.useState(false);
  const [chaptersLoading, setChaptersLoading] = React.useState(false);
  const [sectionsLoading, setSectionsLoading] = React.useState(false);
  const [passagesLoading, setPassagesLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);
  const [editor, setEditor] = React.useState<StructureEditor | null>(null);
  const [passageEditor, setPassageEditor] = React.useState<PassageEditor | null>(
    null
  );
  const [resourcePassage, setResourcePassage] = React.useState<Passage | null>(
    null
  );
  const [passageImport, setPassageImport] =
    React.useState<PassageImportSession | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<ArchiveTarget | null>(
    null
  );
  const contextRequest = React.useRef(0);
  const maqsadRequest = React.useRef(0);
  const chapterRequest = React.useRef(0);
  const sectionRequest = React.useRef(0);
  const passageRequest = React.useRef(0);

  const selectedMaqsad =
    maqasid.find((item) => item.id === selectedMaqsadId) ?? null;
  const selectedChapter =
    chapters.find((item) => item.id === selectedChapterId) ?? null;
  const selectedSection =
    sections.find((item) => item.id === selectedSectionId) ?? null;

  const reportError = React.useCallback((error: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Firestore matn structure operation failed.", error);
    }

    toast.error(getFirestoreErrorMessage(error));
  }, []);

  const loadMaqasid = React.useCallback(
    async (nextMatnId: string) => {
      const requestId = ++maqsadRequest.current;
      setMaqasidLoading(true);

      try {
        const nextMaqasid = await listMaqasid(nextMatnId);

        if (requestId === maqsadRequest.current) {
          setMaqasid(nextMaqasid);
        }
      } catch (error) {
        if (requestId === maqsadRequest.current) {
          reportError(error);
        }
      } finally {
        if (requestId === maqsadRequest.current) {
          setMaqasidLoading(false);
        }
      }
    },
    [reportError]
  );

  const loadChapters = React.useCallback(
    async (parent: ChapterParent) => {
      const requestId = ++chapterRequest.current;
      setChaptersLoading(true);

      try {
        const nextChapters = await listChapters(parent);

        if (requestId === chapterRequest.current) {
          setChapters(nextChapters);
        }
      } catch (error) {
        if (requestId === chapterRequest.current) {
          reportError(error);
        }
      } finally {
        if (requestId === chapterRequest.current) {
          setChaptersLoading(false);
        }
      }
    },
    [reportError]
  );

  const loadSections = React.useCallback(
    async (parent: SectionParent) => {
      const requestId = ++sectionRequest.current;
      setSectionsLoading(true);

      try {
        const nextSections = await listSections(parent);

        if (requestId === sectionRequest.current) {
          setSections(nextSections);
        }
      } catch (error) {
        if (requestId === sectionRequest.current) {
          reportError(error);
        }
      } finally {
        if (requestId === sectionRequest.current) {
          setSectionsLoading(false);
        }
      }
    },
    [reportError]
  );

  const loadPassages = React.useCallback(
    async (parent: PassageParent) => {
      const requestId = ++passageRequest.current;
      setPassagesLoading(true);

      try {
        const nextPassages = await listPassages(parent);

        if (requestId === passageRequest.current) {
          setPassages(nextPassages);
        }
      } catch (error) {
        if (requestId === passageRequest.current) {
          reportError(error);
        }
      } finally {
        if (requestId === passageRequest.current) {
          setPassagesLoading(false);
        }
      }
    },
    [reportError]
  );

  const loadContext = React.useCallback(async () => {
    const requestId = ++contextRequest.current;
    setContextLoading(true);

    try {
      const nextContext = await getMatnStructureContext(matnId);

      if (requestId !== contextRequest.current) {
        return;
      }

      setContext(nextContext);
      setMaqasid([]);
      setChapters([]);
      setSections([]);
      setPassages([]);
      setSelectedMaqsadId(null);
      setSelectedChapterId(null);
      setSelectedSectionId(null);
      setPassageImport(null);
      setResourcePassage(null);
      passageRequest.current += 1;
      setPassagesLoading(false);

      if (!nextContext) {
        return;
      }

      if (nextContext.matn.hasMaqasid) {
        void loadMaqasid(nextContext.matn.id);
      } else if (nextContext.matn.hasChapters) {
        void loadChapters({ matnId: nextContext.matn.id });
      } else if (nextContext.matn.hasSections) {
        void loadSections({ matnId: nextContext.matn.id });
      } else {
        void loadPassages({ matnId: nextContext.matn.id });
      }
    } catch (error) {
      if (requestId === contextRequest.current) {
        reportError(error);
        setContext(null);
      }
    } finally {
      if (requestId === contextRequest.current) {
        setContextLoading(false);
      }
    }
  }, [loadChapters, loadMaqasid, loadPassages, loadSections, matnId, reportError]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  function chapterParent(): ChapterParent | null {
    if (!context) {
      return null;
    }

    if (context.matn.hasMaqasid) {
      return selectedMaqsad
        ? { matnId: context.matn.id, maqsadId: selectedMaqsad.id }
        : null;
    }

    return { matnId: context.matn.id };
  }

  function sectionParent(): SectionParent | null {
    if (!context) {
      return null;
    }

    if (context.matn.hasChapters) {
      if (!selectedChapter) {
        return null;
      }

      return {
        matnId: context.matn.id,
        ...(context.matn.hasMaqasid && selectedMaqsad
          ? { maqsadId: selectedMaqsad.id }
          : {}),
        chapterId: selectedChapter.id,
      };
    }

    if (context.matn.hasMaqasid) {
      return selectedMaqsad
        ? { matnId: context.matn.id, maqsadId: selectedMaqsad.id }
        : null;
    }

    return { matnId: context.matn.id };
  }

  function passageParent(): PassageParent | null {
    if (!context) {
      return null;
    }

    if (context.matn.hasSections) {
      if (!selectedSection) {
        return null;
      }

      return {
        matnId: context.matn.id,
        ...(context.matn.hasMaqasid && selectedMaqsad
          ? { maqsadId: selectedMaqsad.id }
          : {}),
        ...(context.matn.hasChapters && selectedChapter
          ? { chapterId: selectedChapter.id }
          : {}),
        sectionId: selectedSection.id,
      };
    }

    if (context.matn.hasChapters) {
      if (!selectedChapter) {
        return null;
      }

      return {
        matnId: context.matn.id,
        ...(context.matn.hasMaqasid && selectedMaqsad
          ? { maqsadId: selectedMaqsad.id }
          : {}),
        chapterId: selectedChapter.id,
      };
    }

    if (context.matn.hasMaqasid) {
      return selectedMaqsad
        ? { matnId: context.matn.id, maqsadId: selectedMaqsad.id }
        : null;
    }

    return { matnId: context.matn.id };
  }

  function clearPassages() {
    passageRequest.current += 1;
    setPassages([]);
    setPassagesLoading(false);
  }

  function selectMaqsad(item: StructureListItem) {
    if (!context) {
      return;
    }

    setSelectedMaqsadId(item.id);
    setSelectedChapterId(null);
    setSelectedSectionId(null);
    setChapters([]);
    setSections([]);
    clearPassages();
    chapterRequest.current += 1;
    sectionRequest.current += 1;
    setSectionsLoading(false);

    if (context.matn.hasChapters) {
      void loadChapters({ matnId: context.matn.id, maqsadId: item.id });
    } else if (context.matn.hasSections) {
      void loadSections({ matnId: context.matn.id, maqsadId: item.id });
    } else {
      void loadPassages({ matnId: context.matn.id, maqsadId: item.id });
    }
  }

  function selectChapter(item: StructureListItem) {
    if (!context) {
      return;
    }

    setSelectedChapterId(item.id);
    setSelectedSectionId(null);
    setSections([]);
    clearPassages();
    sectionRequest.current += 1;

    if (context.matn.hasSections) {
      void loadSections({
        matnId: context.matn.id,
        ...(context.matn.hasMaqasid && selectedMaqsad
          ? { maqsadId: selectedMaqsad.id }
          : {}),
        chapterId: item.id,
      });
    } else {
      void loadPassages({
        matnId: context.matn.id,
        ...(context.matn.hasMaqasid && selectedMaqsad
          ? { maqsadId: selectedMaqsad.id }
          : {}),
        chapterId: item.id,
      });
    }
  }

  function selectSection(item: StructureListItem) {
    if (!context) {
      return;
    }

    setSelectedSectionId(item.id);
    clearPassages();
    void loadPassages({
      matnId: context.matn.id,
      ...(context.matn.hasMaqasid && selectedMaqsad
        ? { maqsadId: selectedMaqsad.id }
        : {}),
      ...(context.matn.hasChapters && selectedChapter
        ? { chapterId: selectedChapter.id }
        : {}),
      sectionId: item.id,
    });
  }

  function openCreateEditor(entity: StructureEntity) {
    if (entity === "chapter" && !chapterParent()) {
      toast.error("اختر مقصدًا أولًا.");
      return;
    }

    if (entity === "section" && !sectionParent()) {
      toast.error(
        context?.matn.hasChapters ? "اختر بابًا أولًا." : "اختر مقصدًا أولًا."
      );
      return;
    }

    setEditor({ entity });
  }

  function openEditEditor(entity: StructureEntity, item: StructureListItem) {
    setEditor({ entity, item });
  }

  function openCreatePassage() {
    if (!passageParent()) {
      toast.error(
        context?.matn.hasSections
          ? "اختر فصلًا أولًا."
          : context?.matn.hasChapters
            ? "اختر بابًا أولًا."
            : "اختر مقصدًا أولًا."
      );
      return;
    }

    setPassageEditor({});
  }

  function openPassageImport(mode: PassageImportMode) {
    if (!context || context.matn.type !== mode) {
      return;
    }

    const parent = passageParent();

    if (!parent) {
      toast.error(
        context.matn.hasSections
          ? "اختر فصلًا أولًا."
          : context.matn.hasChapters
            ? "اختر بابًا أولًا."
            : "اختر مقصدًا أولًا."
      );
      return;
    }

    setPassageImport({ mode, parent });
  }

  async function handleFormSubmit(values: StructureInput) {
    if (!editor || !context) {
      return;
    }

    setIsMutating(true);

    try {
      const { entity, item } = editor;

      if (entity === "maqsad") {
        if (item) {
          await updateMaqsad(item.id, values);
          await loadMaqasid(context.matn.id);
          toast.success("تم تحديث المقصد.");
        } else {
          const id = await createMaqsad(context.matn.id, values);
          await loadMaqasid(context.matn.id);
          setSelectedMaqsadId(id);
          setSelectedChapterId(null);
          setSelectedSectionId(null);
          setChapters([]);
          setSections([]);
          clearPassages();

          if (context.matn.hasChapters) {
            await loadChapters({ matnId: context.matn.id, maqsadId: id });
          } else if (context.matn.hasSections) {
            await loadSections({ matnId: context.matn.id, maqsadId: id });
          } else {
            await loadPassages({ matnId: context.matn.id, maqsadId: id });
          }

          toast.success("تم إنشاء المقصد.");
        }
      }

      if (entity === "chapter") {
        const parent = chapterParent();

        if (!parent) {
          toast.error("اختر مقصدًا أولًا.");
          return;
        }

        if (item) {
          await updateChapter(item.id, values);
          await loadChapters(parent);
          toast.success("تم تحديث الباب.");
        } else {
          const id = await createChapter(parent, values);
          await loadChapters(parent);
          setSelectedChapterId(id);
          setSelectedSectionId(null);
          clearPassages();

          if (context.matn.hasSections) {
            setSections([]);
            await loadSections({ ...parent, chapterId: id });
          } else {
            await loadPassages({ ...parent, chapterId: id });
          }

          toast.success("تم إنشاء الباب.");
        }
      }

      if (entity === "section") {
        const parent = sectionParent();

        if (!parent) {
          toast.error(
            context.matn.hasChapters ? "اختر بابًا أولًا." : "اختر مقصدًا أولًا."
          );
          return;
        }

        if (item) {
          await updateSection(item.id, values);
          await loadSections(parent);
          toast.success("تم تحديث الفصل.");
        } else {
          const id = await createSection(parent, values);
          await loadSections(parent);
          setSelectedSectionId(id);
          clearPassages();
          await loadPassages({ ...parent, sectionId: id });
          toast.success("تم إنشاء الفصل.");
        }
      }

      setEditor(null);
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePassageFormSubmit(values: PassageInput) {
    if (!passageEditor) {
      return;
    }

    const parent = passageParent();

    if (!parent) {
      return;
    }

    setIsMutating(true);

    try {
      if (passageEditor.item) {
        await updatePassage(passageEditor.item.id, values);
        await loadPassages(parent);
        toast.success("تم تحديث المقطع.");
      } else {
        await createPassage(parent, values);
        await loadPassages(parent);
        toast.success("تم إضافة المقطع.");
      }

      setPassageEditor(null);
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePassageImportSave(
    mode: PassageImportMode,
    draftPassages: readonly DraftPassage[]
  ) {
    const currentParent = passageParent();

    const hasSameParent =
      currentParent &&
      passageImport &&
      passageImport.mode === mode &&
      currentParent.matnId === passageImport.parent.matnId &&
      currentParent.maqsadId === passageImport.parent.maqsadId &&
      currentParent.chapterId === passageImport.parent.chapterId &&
      currentParent.sectionId === passageImport.parent.sectionId;

    if (
      !context ||
      context.matn.type !== mode ||
      !currentParent ||
      !hasSameParent
    ) {
      toast.error("تغيّر موضع المقاطع. افتح المسودة من الموضع الصحيح.");
      return false;
    }

    const texts = draftPassages.map((passage) => passage.text.trim());

    if (texts.length === 0 || texts.some((text) => !text)) {
      toast.error(
        mode === "POETRY"
          ? "أكمل نص كل بيت قبل الحفظ."
          : "أكمل نص كل مقطع قبل الحفظ."
      );
      return false;
    }

    setIsMutating(true);

    try {
      const latestContext = await getMatnStructureContext(currentParent.matnId);

      if (!latestContext || latestContext.matn.type !== mode) {
        toast.error(
          mode === "POETRY"
            ? "هذا المحرر مخصص للمتون الشعرية فقط."
            : "هذا المحرر مخصص للمتون النثرية فقط."
        );
        return false;
      }

      const count = await appendPassages(currentParent, texts);
      await loadPassages(currentParent);
      toast.success(
        mode === "POETRY"
          ? `تم حفظ ${count} ${count === 1 ? "بيت" : "أبيات"}.`
          : `تم حفظ ${count} ${count === 1 ? "مقطع" : "مقاطع"}.`
      );
      return true;
    } catch (error) {
      reportError(error);
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePassageActiveChange(passage: Passage) {
    const parent = passageParent();

    if (!parent) {
      return;
    }

    setIsMutating(true);

    try {
      const isActive = !passage.isActive;
      await setPassageActive(passage.id, isActive);
      await loadPassages(parent);
      toast.success(isActive ? "تم تفعيل المقطع." : "تم إيقاف المقطع.");
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleActiveChange(
    entity: StructureEntity,
    item: StructureListItem
  ) {
    if (!context) {
      return;
    }

    setIsMutating(true);

    try {
      const isActive = !item.isActive;

      if (entity === "maqsad") {
        await setMaqsadActive(item.id, isActive);
        await loadMaqasid(context.matn.id);
      }

      if (entity === "chapter") {
        const parent = chapterParent();

        if (!parent) {
          return;
        }

        await setChapterActive(item.id, isActive);
        await loadChapters(parent);
      }

      if (entity === "section") {
        const parent = sectionParent();

        if (!parent) {
          return;
        }

        await setSectionActive(item.id, isActive);
        await loadSections(parent);
      }

      toast.success(isActive ? "تم تفعيل العنصر." : "تم إيقاف العنصر.");
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget || !context) {
      return;
    }

    setIsMutating(true);

    try {
      const { entity, item } = archiveTarget;
      const isArchived = !item.isArchived;

      if (entity === "maqsad") {
        await setMaqsadArchived(item.id, context.matn.id, isArchived);
        await loadMaqasid(context.matn.id);

        if (isArchived && item.id === selectedMaqsadId) {
          setSelectedMaqsadId(null);
          setSelectedChapterId(null);
          setSelectedSectionId(null);
          setChapters([]);
          setSections([]);
          clearPassages();
        }
      }

      if (entity === "chapter") {
        const parent = chapterParent();

        if (!parent) {
          return;
        }

        await setChapterArchived(item.id, parent, isArchived);
        await loadChapters(parent);

        if (isArchived && item.id === selectedChapterId) {
          setSelectedChapterId(null);
          setSelectedSectionId(null);
          setSections([]);
          clearPassages();
        }
      }

      if (entity === "section") {
        const parent = sectionParent();

        if (!parent) {
          return;
        }

        await setSectionArchived(item.id, parent, isArchived);
        await loadSections(parent);

        if (isArchived && item.id === selectedSectionId) {
          setSelectedSectionId(null);
          clearPassages();
        }
      }

      if (entity === "passage") {
        const parent = passageParent();

        if (!parent) {
          return;
        }

        await setPassageArchived(item.id, parent, isArchived);
        await loadPassages(parent);
        toast.success(isArchived ? "تم أرشفة المقطع." : "تم استعادة المقطع.");
        setArchiveTarget(null);
        return;
      }

      toast.success(isArchived ? "تمت أرشفة العنصر." : "تمت استعادة العنصر.");
      setArchiveTarget(null);
    } catch (error) {
      reportError(error);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleReorder(
    entity: StructureEntity,
    items: readonly StructureListItem[]
  ) {
    if (!context) {
      return;
    }

    setIsMutating(true);

    try {
      const changed =
        entity === "maqsad"
          ? await reorderMaqasid(items)
          : entity === "chapter"
            ? await reorderChapters(items)
            : await reorderSections(items);

      if (entity === "maqsad") {
        await loadMaqasid(context.matn.id);
      }

      if (entity === "chapter") {
        const parent = chapterParent();
        if (parent) {
          await loadChapters(parent);
        }
      }

      if (entity === "section") {
        const parent = sectionParent();
        if (parent) {
          await loadSections(parent);
        }
      }

      if (changed) {
        toast.success("تمت إعادة ترتيب العناصر.");
      }
    } catch (error) {
      reportError(error);

      if (entity === "maqsad") {
        await loadMaqasid(context.matn.id);
      }

      if (entity === "chapter") {
        const parent = chapterParent();
        if (parent) {
          await loadChapters(parent);
        }
      }

      if (entity === "section") {
        const parent = sectionParent();
        if (parent) {
          await loadSections(parent);
        }
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePassageReorder(items: readonly Passage[]) {
    const parent = passageParent();

    if (!parent) {
      return;
    }

    setIsMutating(true);

    try {
      const changed = await reorderPassages(items);

      if (changed) {
        toast.success("تم تحديث ترتيب المقاطع.");
      }
    } catch (error) {
      reportError(error);
      await loadPassages(parent);
    } finally {
      setIsMutating(false);
    }
  }

  if (contextLoading) {
    return <p className="mt-8 text-sm text-muted-foreground">جارٍ تحميل بنية المتن...</p>;
  }

  if (!context) {
    return (
      <div className="mt-8 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        تعذر العثور على هذا المتن.
      </div>
    );
  }

  const { matn } = context;
  const enabledLayers = [
    matn.hasMaqasid ? "مقاصد" : null,
    matn.hasChapters ? "أبواب" : null,
    matn.hasSections ? "فصول" : null,
  ].filter(Boolean) as string[];
  const gridColumns =
    enabledLayers.length === 1
      ? "xl:grid-cols-1"
      : enabledLayers.length === 2
        ? "xl:grid-cols-2"
        : "xl:grid-cols-3";
  const chaptersParent = chapterParent();
  const sectionsParent = sectionParent();
  const passagesParent = passageParent();
  const passageContextLabel = selectedSection?.title ?? selectedChapter?.title ?? selectedMaqsad?.title;
  const passagePrompt = matn.hasSections
    ? "اختر فصلًا لعرض المقاطع."
    : matn.hasChapters
      ? "اختر بابًا لعرض المقاطع."
      : matn.hasMaqasid
        ? "اختر مقصدًا لعرض المقاطع."
        : "المقاطع التابعة لهذا المتن.";
  const passageDescription = passagesParent
    ? passageContextLabel
      ? `مقاطع «${passageContextLabel}».`
      : "المقاطع التابعة لهذا المتن."
    : passagePrompt;
  const importContextLabel = [
    selectedMaqsad?.title,
    selectedChapter?.title,
    selectedSection?.title,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" ← ");
  const archiveItemName = archiveTarget
    ? archiveTarget.entity === "passage"
      ? (() => {
          const sequence = passages
            .filter((item) => !item.isArchived)
            .findIndex((item) => item.id === archiveTarget.item.id);

          return sequence >= 0 ? `المقطع ${sequence + 1}` : "المقطع المؤرشف";
        })()
      : archiveTarget.item.title
    : null;

  return (
    <div className="mt-8 space-y-4">
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ms-1")}
          >
            العودة إلى الإدارة
          </Link>
          <ChevronLeft className="size-4 rtl:rotate-180" />
          <span>الإدارة</span>
          {context.level ? (
            <>
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span>{context.level.name}</span>
            </>
          ) : null}
          {context.science ? (
            <>
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span>{context.science.name}</span>
            </>
          ) : null}
          <ChevronLeft className="size-4 rtl:rotate-180" />
          <span className="font-medium text-foreground">{matn.name}</span>
          {selectedMaqsad ? (
            <>
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span>{selectedMaqsad.title}</span>
            </>
          ) : null}
          {selectedChapter ? (
            <>
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span>{selectedChapter.title}</span>
            </>
          ) : null}
          {selectedSection ? (
            <>
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span>{selectedSection.title}</span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{matn.name}</h2>
          <Badge variant="secondary">{matn.type === "PROSE" ? "نثر" : "شعر"}</Badge>
          {enabledLayers.map((layer) => (
            <Badge key={layer} variant="outline">
              {layer}
            </Badge>
          ))}
        </div>
      </div>

      {passageImport ? (
        <PassageImportEditor
          mode={passageImport.mode}
          matnName={matn.name}
          contextLabel={importContextLabel || "المتن مباشرة"}
          parent={passageImport.parent}
          isSaving={isMutating}
          onExit={() => setPassageImport(null)}
          onSave={(draftPassages) =>
            handlePassageImportSave(passageImport.mode, draftPassages)
          }
        />
      ) : (
        <>
          {enabledLayers.length > 0 ? (
            <div className={cn("grid grid-cols-1 gap-4", gridColumns)}>
          {matn.hasMaqasid ? (
            <StructureList
              title="المقاصد"
              description="اختر مقصدًا لإدارة طبقاته التابعة."
              createLabel="إضافة مقصد"
              emptyMessage="لا توجد مقاصد بعد."
              items={maqasid}
              group={`maqasid-${matn.id}`}
              selectedItemId={selectedMaqsadId}
              isLoading={maqasidLoading}
              isBusy={isMutating}
              onCreate={() => openCreateEditor("maqsad")}
              onSelect={selectMaqsad}
              onEdit={(item) => openEditEditor("maqsad", item)}
              onSetActive={(item) => void handleActiveChange("maqsad", item)}
              onSetArchived={(item) =>
                setArchiveTarget({ entity: "maqsad", item })
              }
              onReorder={(items) => void handleReorder("maqsad", items)}
            />
          ) : null}

          {matn.hasChapters ? (
            <StructureList
              title="الأبواب"
              description={
                matn.hasMaqasid
                  ? selectedMaqsad
                    ? `أبواب «${selectedMaqsad.title}».`
                    : "اختر مقصدًا لعرض أبوابه."
                  : "الأبواب التابعة لهذا المتن."
              }
              createLabel="إضافة باب"
              emptyMessage={
                matn.hasMaqasid && !selectedMaqsad
                  ? "اختر مقصدًا أولًا."
                  : "لا توجد أبواب بعد."
              }
              items={chapters}
              group={`chapters-${chaptersParent?.maqsadId ?? matn.id}`}
              selectedItemId={selectedChapterId}
              isLoading={chaptersLoading}
              isDisabled={!chaptersParent}
              isBusy={isMutating}
              onCreate={() => openCreateEditor("chapter")}
              onSelect={selectChapter}
              onEdit={(item) => openEditEditor("chapter", item)}
              onSetActive={(item) => void handleActiveChange("chapter", item)}
              onSetArchived={(item) =>
                setArchiveTarget({ entity: "chapter", item })
              }
              onReorder={(items) => void handleReorder("chapter", items)}
            />
          ) : null}

          {matn.hasSections ? (
            <StructureList
              title="الفصول"
              description={
                matn.hasChapters
                  ? selectedChapter
                    ? `فصول «${selectedChapter.title}».`
                    : "اختر بابًا لعرض فصوله."
                  : matn.hasMaqasid
                    ? selectedMaqsad
                      ? `فصول «${selectedMaqsad.title}».`
                      : "اختر مقصدًا لعرض فصوله."
                    : "الفصول التابعة لهذا المتن."
              }
              createLabel="إضافة فصل"
              emptyMessage={
                !sectionsParent
                  ? matn.hasChapters
                    ? "اختر بابًا أولًا."
                    : "اختر مقصدًا أولًا."
                  : "لا توجد فصول بعد."
              }
              items={sections}
              group={`sections-${sectionsParent?.chapterId ?? sectionsParent?.maqsadId ?? matn.id}`}
              selectedItemId={selectedSectionId}
              isLoading={sectionsLoading}
              isDisabled={!sectionsParent}
              isBusy={isMutating}
              onCreate={() => openCreateEditor("section")}
              onSelect={selectSection}
              onEdit={(item) => openEditEditor("section", item)}
              onSetActive={(item) => void handleActiveChange("section", item)}
              onSetArchived={(item) =>
                setArchiveTarget({ entity: "section", item })
              }
              onReorder={(items) => void handleReorder("section", items)}
            />
          ) : null}
            </div>
          ) : null}

          <PassageList
            description={passageDescription}
            emptyMessage={passagesParent ? "لا توجد مقاطع بعد." : passagePrompt}
            items={passages}
            group={`passages-${passagesParent?.sectionId ?? passagesParent?.chapterId ?? passagesParent?.maqsadId ?? matn.id}`}
            isLoading={passagesLoading}
            isDisabled={!passagesParent}
            isBusy={isMutating}
            onCreate={openCreatePassage}
            textImportAction={
              matn.type === "PROSE"
                ? {
                    label: "إدخال نص وتقسيمه",
                    onClick: () => openPassageImport("PROSE"),
                  }
                : {
                    label: "إدخال أبيات وتقسيمها",
                    onClick: () => openPassageImport("POETRY"),
                  }
            }
            onEdit={(passage) => setPassageEditor({ item: passage })}
            onManageResources={setResourcePassage}
            onSetActive={(passage) => void handlePassageActiveChange(passage)}
            onSetArchived={(passage) =>
              setArchiveTarget({ entity: "passage", item: passage })
            }
            onReorder={(items) => void handlePassageReorder(items)}
          />
        </>
      )}

      <StructureFormDialog
        editor={editor}
        isSubmitting={isMutating}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setEditor(null);
          }
        }}
        onSubmit={(values) => void handleFormSubmit(values)}
      />

      <PassageFormDialog
        editor={passageEditor}
        isSubmitting={isMutating}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setPassageEditor(null);
          }
        }}
        onSubmit={(values) => void handlePassageFormSubmit(values)}
      />

      <PassageResourcesDialog
        passage={resourcePassage}
        onOpenChange={(open) => {
          if (!open) {
            setResourcePassage(null);
          }
        }}
      />

      <ArchiveContentDialog
        itemName={archiveItemName}
        isArchived={archiveTarget?.item.isArchived ?? false}
        isSubmitting={isMutating}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setArchiveTarget(null);
          }
        }}
        onConfirm={() => void handleArchiveConfirm()}
      />
    </div>
  );
}
