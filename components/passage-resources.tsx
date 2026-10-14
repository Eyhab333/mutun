"use client";

import * as React from "react";
import {
  AudioLines,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Video as VideoIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listActivePassageResources } from "@/lib/firestore/passage-resources";
import { getPassageResourceFileUrl } from "@/lib/storage/passage-resources";
import { cn } from "@/lib/utils";
import type { PassageResource, PassageResourceType } from "@/types";

type PassageResourcesProps = {
  passageId: string;
  variant: "reader" | "focus";
  className?: string;
};

type ResourceDetails = {
  label: string;
  Icon: LucideIcon;
};

const resourceDetails: Record<PassageResourceType, ResourceDetails> = {
  NOTE: { label: "ملاحظة", Icon: FileText },
  YOUTUBE: { label: "فيديو", Icon: VideoIcon },
  IMAGE: { label: "صورة", Icon: ImageIcon },
  AUDIO: { label: "صوت", Icon: AudioLines },
};

function getResourceLabel(resource: PassageResource) {
  return resource.title?.trim() || resourceDetails[resource.type].label;
}

function getSafeHttpUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getYoutubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId: string | null = null;

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    }

    return videoId && /^[a-zA-Z0-9_-]{6,}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
      : null;
  } catch {
    return null;
  }
}

function ExternalResourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      فتح الرابط في تبويب جديد
      <ExternalLink className="size-4" />
    </a>
  );
}

function UnavailableResource() {
  return (
    <p className="text-sm leading-7 text-muted-foreground">
      لا يتوفر رابط صالح لعرض هذا المورد.
    </p>
  );
}

function ResourceViewer({
  resource,
  resolvedStorageUrl,
  resolvedStoragePath,
  storageStatus,
}: {
  resource: PassageResource;
  resolvedStorageUrl: string | null;
  resolvedStoragePath: string | null;
  storageStatus: "idle" | "loading" | "ready" | "error";
}) {
  const isStorageFile = Boolean(
    resource.storagePath && (resource.type === "IMAGE" || resource.type === "AUDIO")
  );
  const url = isStorageFile
    ? resource.storagePath === resolvedStoragePath
      ? resolvedStorageUrl
      : null
    : getSafeHttpUrl(resource.url);

  if (resource.type === "NOTE") {
    return resource.text ? (
      <p className="whitespace-pre-wrap text-base leading-8 text-foreground">
        {resource.text}
      </p>
    ) : (
      <UnavailableResource />
    );
  }

  if (isStorageFile && storageStatus === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        جارٍ تحميل الملف...
      </div>
    );
  }

  if (isStorageFile && storageStatus === "error") {
    return (
      <p className="text-sm leading-7 text-muted-foreground">
        تعذر تحميل الملف المرفوع لهذا المورد.
      </p>
    );
  }

  if (!url) {
    return <UnavailableResource />;
  }

  if (resource.type === "YOUTUBE") {
    const embedUrl = getYoutubeEmbedUrl(url);

    return (
      <div className="space-y-4">
        {embedUrl ? (
          <iframe
            title={getResourceLabel(resource)}
            src={embedUrl}
            className="aspect-video w-full rounded-lg border bg-muted"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            يتعذر عرض الفيديو داخل التطبيق لهذا الرابط.
          </p>
        )}
        {!isStorageFile ? <ExternalResourceLink url={url} /> : null}
      </div>
    );
  }

  if (resource.type === "IMAGE") {
    return (
      <div className="space-y-4">
        <img
          src={url}
          alt={resource.title?.trim() || "صورة تعليمية"}
          className="mx-auto max-h-[65dvh] max-w-full rounded-lg border object-contain"
        />
        {!isStorageFile ? <ExternalResourceLink url={url} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <audio controls preload="metadata" className="w-full" src={url}>
        يتعذر تشغيل هذا الملف الصوتي داخل المتصفح.
      </audio>
      {!isStorageFile ? <ExternalResourceLink url={url} /> : null}
    </div>
  );
}

function useResolvedStorageUrl(
  resource: PassageResource | null,
  storageUrlCache: Map<string, string>
) {
  const [state, setState] = React.useState<{
    storagePath: string | null;
    url: string | null;
    status: "idle" | "loading" | "ready" | "error";
  }>({ storagePath: null, url: null, status: "idle" });

  React.useEffect(() => {
    const storagePath = resource?.storagePath;

    if (
      !resource ||
      !storagePath ||
      (resource.type !== "IMAGE" && resource.type !== "AUDIO")
    ) {
      setState({ storagePath: null, url: null, status: "idle" });
      return;
    }

    let isCurrent = true;
    const cachedUrl = storageUrlCache.get(storagePath);

    if (cachedUrl) {
      setState({ storagePath, url: cachedUrl, status: "ready" });
      return;
    }

    setState({ storagePath, url: null, status: "loading" });

    void getPassageResourceFileUrl(storagePath)
      .then((url) => {
        if (isCurrent) {
          storageUrlCache.set(storagePath, url);
          setState({ storagePath, url, status: "ready" });
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Unable to resolve a passage resource Storage file.", error);
        }

        if (isCurrent) {
          setState({ storagePath, url: null, status: "error" });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [resource?.id, resource?.storagePath, resource?.type, storageUrlCache]);

  return state;
}

function ResourceDialog({
  resource,
  storageUrlCache,
  onOpenChange,
}: {
  resource: PassageResource | null;
  storageUrlCache: Map<string, string>;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    status: storageStatus,
    storagePath: resolvedStoragePath,
    url: resolvedStorageUrl,
  } = useResolvedStorageUrl(resource, storageUrlCache);

  const activeStorageStatus =
    resource?.storagePath && resource.storagePath !== resolvedStoragePath
      ? "loading"
      : storageStatus;

  if (!resource) {
    return null;
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getResourceLabel(resource)}</DialogTitle>
          <DialogDescription>
            {resourceDetails[resource.type].label} مساعد للمقطع الحالي.
          </DialogDescription>
        </DialogHeader>
        <ResourceViewer
          resource={resource}
          resolvedStorageUrl={resolvedStorageUrl}
          resolvedStoragePath={resolvedStoragePath}
          storageStatus={activeStorageStatus}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PassageResources({
  passageId,
  variant,
  className,
}: PassageResourcesProps) {
  const [resources, setResources] = React.useState<PassageResource[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [selectedResource, setSelectedResource] =
    React.useState<PassageResource | null>(null);
  const requestRef = React.useRef(0);
  const storageUrlCacheRef = React.useRef(new Map<string, string>());

  const loadResources = React.useCallback(async () => {
    const requestId = ++requestRef.current;
    setStatus("loading");

    try {
      const nextResources = await listActivePassageResources(passageId);

      if (requestId === requestRef.current) {
        setResources(nextResources);
        setStatus("ready");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load passage resources.", error);
      }

      if (requestId === requestRef.current) {
        setResources([]);
        setStatus("error");
      }
    }
  }, [passageId]);

  React.useEffect(() => {
    setSelectedResource(null);
    void loadResources();
  }, [loadResources]);

  const isReader = variant === "reader";

  if (status === "loading") {
    return (
      <span className="sr-only" aria-live="polite">
        جارٍ تحميل المساعدات...
      </span>
    );
  }

  if (status === "error") {
    return (
      <Button
        type="button"
        variant="ghost"
        size={isReader ? "sm" : "icon-sm"}
        className={cn("text-muted-foreground", isReader ? "mt-4" : "mt-3", className)}
        onClick={() => void loadResources()}
        aria-label="إعادة محاولة تحميل الموارد"
        title="إعادة محاولة تحميل الموارد"
      >
        <RefreshCw />
        {isReader ? "تعذر تحميل المساعدات" : null}
      </Button>
    );
  }

  if (resources.length === 0) {
    return null;
  }

  return (
    <>
      <section
        className={cn(
          isReader ? "mt-5 space-y-2" : "mt-4 flex flex-wrap justify-center gap-1.5",
          className
        )}
        aria-label="مساعدات التعلم"
      >
        {isReader ? (
          <p className="text-sm font-medium text-muted-foreground">مساعدات التعلم</p>
        ) : null}
        <div className={cn("flex flex-wrap gap-1.5", !isReader && "justify-center")}>
          {resources.map((resource) => {
            const { Icon } = resourceDetails[resource.type];
            const label = getResourceLabel(resource);

            return (
              <Button
                key={resource.id}
                type="button"
                variant="outline"
                size={isReader ? "sm" : "icon-sm"}
                className={cn(!isReader && "rounded-full")}
                onClick={() => setSelectedResource(resource)}
                aria-label={label}
                title={label}
              >
                <Icon />
                {isReader ? <span className="max-w-44 truncate">{label}</span> : null}
              </Button>
            );
          })}
        </div>
      </section>

      <ResourceDialog
        resource={selectedResource}
        storageUrlCache={storageUrlCacheRef.current}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedResource(null);
          }
        }}
      />
    </>
  );
}
