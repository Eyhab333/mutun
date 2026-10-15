"use client";

import {
  Archive,
  ArchiveRestore,
  AudioLines,
  FileText,
  GripVertical,
  Image,
  Pencil,
  Power,
  type LucideIcon,
  VideoIcon,
} from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PassageResource, PassageResourceType } from "@/types";

type SortablePassageResourceItemProps = {
  resource: PassageResource;
  index: number;
  group: string;
  isBusy: boolean;
  onEdit: (resource: PassageResource) => void;
  onSetActive: (resource: PassageResource) => void;
  onSetArchived: (resource: PassageResource) => void;
};

const resourceTypeDetails: Record<
  PassageResourceType,
  { label: string; Icon: LucideIcon }
> = {
  NOTE: { label: "ملاحظة", Icon: FileText },
  YOUTUBE: { label: "YouTube", Icon: VideoIcon },
  IMAGE: { label: "صورة", Icon: Image },
  AUDIO: { label: "صوت", Icon: AudioLines },
};

function getUrlPreview(url: string | undefined) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;

    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

function getResourcePreview(resource: PassageResource) {
  if (resource.type === "NOTE") {
    return resource.text ?? "";
  }

  if (resource.url) {
    return getUrlPreview(resource.url);
  }

  return resource.storagePath ? "ملف مرفوع" : "";
}

function ResourceDetails({
  resource,
  archived = false,
}: {
  resource: PassageResource;
  archived?: boolean;
}) {
  const { Icon, label } = resourceTypeDetails[resource.type];
  const preview = getResourcePreview(resource);

  return (
    <div className="min-w-0 flex-1 space-y-1 px-1 py-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{resource.title || label}</span>
        <Badge variant="outline">{label}</Badge>
        {archived ? (
          <Badge variant="secondary">مؤرشف</Badge>
        ) : resource.isActive ? (
          <Badge variant="secondary">نشط</Badge>
        ) : (
          <Badge variant="outline">غير نشط</Badge>
        )}
      </div>
      {preview ? (
        <p
          className={cn(
            "text-sm leading-6 text-muted-foreground",
            resource.type === "NOTE" ? "line-clamp-2 whitespace-pre-wrap" : "truncate"
          )}
          dir={resource.type === "NOTE" || !resource.url ? undefined : "ltr"}
        >
          {preview}
        </p>
      ) : null}
    </div>
  );
}

export function SortablePassageResourceItem({
  resource,
  index,
  group,
  isBusy,
  onEdit,
  onSetActive,
  onSetArchived,
}: SortablePassageResourceItemProps) {
  const { handleRef, isDragging, isDropTarget, ref } = useSortable({
    id: resource.id,
    index,
    group,
  });

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-background p-2.5 transition-colors",
        isDropTarget && "ring-1 ring-primary/40",
        isDragging && "opacity-50"
      )}
    >
      <button
        ref={handleRef}
        type="button"
        className="mt-0.5 inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`سحب المورد ${index + 1} لإعادة الترتيب`}
        title="سحب لإعادة الترتيب"
        disabled={isBusy}
      >
        <GripVertical className="size-4" />
      </button>

      <ResourceDetails resource={resource} />

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetActive(resource)}
          disabled={isBusy}
          aria-label={resource.isActive ? "إيقاف المورد" : "تفعيل المورد"}
          title={resource.isActive ? "إيقاف" : "تفعيل"}
        >
          <Power />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(resource)}
          disabled={isBusy}
          aria-label="تعديل المورد"
          title="تعديل"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetArchived(resource)}
          disabled={isBusy}
          aria-label="أرشفة المورد"
          title="أرشفة"
        >
          <Archive />
        </Button>
      </div>
    </li>
  );
}

type ArchivedPassageResourceItemProps = Omit<
  SortablePassageResourceItemProps,
  "index" | "group" | "onSetActive"
>;

export function ArchivedPassageResourceItem({
  resource,
  isBusy,
  onEdit,
  onSetArchived,
}: ArchivedPassageResourceItemProps) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-dashed p-2.5">
      <ResourceDetails resource={resource} archived />
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(resource)}
          disabled={isBusy}
          aria-label="تعديل المورد"
          title="تعديل"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onSetArchived(resource)}
          disabled={isBusy}
          aria-label="استعادة المورد"
          title="استعادة"
        >
          <ArchiveRestore />
        </Button>
      </div>
    </li>
  );
}
