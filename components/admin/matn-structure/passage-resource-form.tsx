"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PassageResourceInput } from "@/lib/firestore/passage-resources";
import {
  PassageResourceFileValidationError,
  validatePassageResourceFile,
} from "@/lib/storage/passage-resources";
import type { PassageResource, PassageResourceType } from "@/types";

export type PassageResourceEditor = {
  item?: PassageResource;
};

type PassageResourceFormProps = {
  editor: PassageResourceEditor;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: PassageResourceInput) => void;
};

type FileSource = "UPLOAD" | "URL";

const resourceTypeLabels: Record<PassageResourceType, string> = {
  NOTE: "ملاحظة",
  YOUTUBE: "YouTube",
  IMAGE: "صورة",
  AUDIO: "صوت",
};

function isValidUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isFileResourceType(
  type: PassageResourceType
): type is "IMAGE" | "AUDIO" {
  return type === "IMAGE" || type === "AUDIO";
}

export function PassageResourceForm({
  editor,
  isSubmitting,
  onCancel,
  onSubmit,
}: PassageResourceFormProps) {
  const [type, setType] = React.useState<PassageResourceType>("NOTE");
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileSource, setFileSource] = React.useState<FileSource>("URL");
  const [fileInputKey, setFileInputKey] = React.useState(0);
  const [isActive, setIsActive] = React.useState(true);
  const [validationMessage, setValidationMessage] = React.useState("");
  const isEditing = Boolean(editor.item);
  const isNote = type === "NOTE";
  const isYoutube = type === "YOUTUBE";
  const isFileResource = isFileResourceType(type);
  const isKeepingExistingUpload =
    isFileResource &&
    fileSource === "UPLOAD" &&
    editor.item?.type === type &&
    Boolean(editor.item.storagePath) &&
    !file;

  React.useEffect(() => {
    const item = editor.item;

    setType(item?.type ?? "NOTE");
    setTitle(item?.title ?? "");
    setText(item?.text ?? "");
    setUrl(item?.url ?? "");
    setFile(null);
    setFileSource(item?.storagePath ? "UPLOAD" : "URL");
    setFileInputKey((current) => current + 1);
    setIsActive(item?.isActive ?? true);
    setValidationMessage("");
  }, [editor]);

  function resetSelectedFile() {
    setFile(null);
    setFileInputKey((current) => current + 1);
  }

  function changeType(nextType: PassageResourceType) {
    setType(nextType);
    setText("");
    setUrl("");
    setFileSource("URL");
    resetSelectedFile();
    setValidationMessage("");
  }

  function changeFileSource(nextSource: FileSource) {
    setFileSource(nextSource);
    setUrl("");
    resetSelectedFile();
    setValidationMessage("");
  }

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (!nextFile || !isFileResourceType(type)) {
      setFile(null);
      return;
    }

    try {
      validatePassageResourceFile(nextFile, type);
      setFile(nextFile);
      setValidationMessage("");
    } catch (error) {
      setFile(null);
      event.target.value = "";
      setValidationMessage(
        error instanceof PassageResourceFileValidationError
          ? error.message
          : "تعذر التحقق من الملف."
      );
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedText = text.trim();
    const normalizedUrl = url.trim();

    if (isNote && !normalizedText) {
      setValidationMessage("نص الملاحظة مطلوب.");
      return;
    }

    if (isYoutube && !isValidUrl(normalizedUrl)) {
      setValidationMessage("أدخل رابط YouTube صالحًا.");
      return;
    }

    if (isFileResource && fileSource === "URL" && !isValidUrl(normalizedUrl)) {
      setValidationMessage("أدخل رابطًا صالحًا.");
      return;
    }

    if (isFileResource && fileSource === "UPLOAD" && !file && validationMessage) {
      return;
    }

    if (isFileResource && fileSource === "UPLOAD" && !file && !isKeepingExistingUpload) {
      setValidationMessage("اختر ملفًا للرفع.");
      return;
    }

    if (file && isFileResourceType(type)) {
      try {
        validatePassageResourceFile(file, type);
      } catch (error) {
        setValidationMessage(
          error instanceof PassageResourceFileValidationError
            ? error.message
            : "تعذر التحقق من الملف."
        );
        return;
      }
    }

    setValidationMessage("");
    onSubmit({
      type,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(isNote
        ? { text: normalizedText }
        : isFileResource && fileSource === "UPLOAD"
          ? file
            ? { file }
            : {}
          : { url: normalizedUrl }),
      isActive,
    });
  }

  const urlLabel =
    type === "YOUTUBE"
      ? "رابط YouTube"
      : type === "IMAGE"
        ? "رابط الصورة"
        : "رابط الصوت";
  const acceptedFileTypes =
    type === "IMAGE"
      ? "image/jpeg,image/png,image/webp"
      : "audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm";

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor="passage-resource-type">النوع</Label>
        <select
          id="passage-resource-type"
          value={type}
          onChange={(event) => changeType(event.target.value as PassageResourceType)}
          disabled={isSubmitting}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {(Object.keys(resourceTypeLabels) as PassageResourceType[]).map((item) => (
            <option key={item} value={item}>
              {resourceTypeLabels[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="passage-resource-title">
          العنوان <span className="text-muted-foreground">(اختياري)</span>
        </Label>
        <Input
          id="passage-resource-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSubmitting}
          autoFocus
        />
      </div>

      {isNote ? (
        <div className="grid gap-2">
          <Label htmlFor="passage-resource-text">نص الملاحظة</Label>
          <Textarea
            id="passage-resource-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isSubmitting}
            rows={6}
            aria-invalid={Boolean(validationMessage) || undefined}
          />
        </div>
      ) : isFileResource ? (
        <div className="grid gap-4 rounded-lg border p-3">
          <div className="grid gap-2">
            <Label htmlFor="passage-resource-file-source">المصدر</Label>
            <select
              id="passage-resource-file-source"
              value={fileSource}
              onChange={(event) => changeFileSource(event.target.value as FileSource)}
              disabled={isSubmitting}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="UPLOAD">رفع ملف</option>
              <option value="URL">رابط خارجي</option>
            </select>
          </div>

          {fileSource === "UPLOAD" ? (
            <div className="grid gap-2">
              <Label htmlFor="passage-resource-file">
                {isKeepingExistingUpload ? "استبدال الملف (اختياري)" : "الملف"}
              </Label>
              <Input
                key={fileInputKey}
                id="passage-resource-file"
                type="file"
                accept={acceptedFileTypes}
                disabled={isSubmitting}
                onChange={selectFile}
                aria-invalid={Boolean(validationMessage) || undefined}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {type === "IMAGE"
                  ? "JPG أو PNG أو WebP، حتى 10 MB."
                  : "ملف صوتي مدعوم، حتى 100 MB."}
              </p>
              {file ? (
                <p className="text-xs text-muted-foreground">{file.name}</p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="passage-resource-url">{urlLabel}</Label>
              <Input
                id="passage-resource-url"
                type="url"
                dir="ltr"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(validationMessage) || undefined}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="passage-resource-url">{urlLabel}</Label>
          <Input
            id="passage-resource-url"
            type="url"
            dir="ltr"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={isSubmitting}
            aria-invalid={Boolean(validationMessage) || undefined}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="passage-resource-active">نشط</Label>
        <Switch
          id="passage-resource-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isSubmitting}
        />
      </div>

      {validationMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {validationMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
          {isSubmitting && isFileResource && fileSource === "UPLOAD"
            ? "جارٍ الرفع..."
            : isEditing
              ? "حفظ التغييرات"
              : "إضافة المورد"}
        </Button>
      </div>
    </form>
  );
}
