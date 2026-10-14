"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { StructureInput } from "@/lib/firestore/matn-structure";

export type StructureEntity = "maqsad" | "chapter" | "section";

export type StructureListItem = {
  id: string;
  title: string;
  order: number;
  isActive: boolean;
  isArchived: boolean;
};

export type StructureEditor = {
  entity: StructureEntity;
  item?: StructureListItem;
};

type StructureFormDialogProps = {
  editor: StructureEditor | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StructureInput) => void;
};

const entityLabels: Record<StructureEntity, string> = {
  maqsad: "المقصد",
  chapter: "الباب",
  section: "الفصل",
};

export function StructureFormDialog({
  editor,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: StructureFormDialogProps) {
  const [title, setTitle] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [validationMessage, setValidationMessage] = React.useState("");

  React.useEffect(() => {
    setTitle(editor?.item?.title ?? "");
    setIsActive(editor?.item?.isActive ?? true);
    setValidationMessage("");
  }, [editor]);

  const entity = editor?.entity ?? "maqsad";
  const label = entityLabels[entity];
  const isEditing = Boolean(editor?.item);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setValidationMessage(`عنوان ${label} مطلوب.`);
      return;
    }

    setValidationMessage("");
    onSubmit({ title: trimmedTitle, isActive });
  }

  return (
    <Dialog open={Boolean(editor)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `تعديل ${label}` : `إضافة ${label}`}
          </DialogTitle>
          <DialogDescription>
            يُضاف العنصر الجديد في نهاية الترتيب الحالي، ويمكن ترتيب العناصر
            بالسحب لاحقًا.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="structure-title">العنوان</Label>
            <Input
              id="structure-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isSubmitting}
              autoFocus
              aria-invalid={Boolean(validationMessage) || undefined}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="structure-active">نشط</Label>
            <Switch
              id="structure-active"
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

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
              {isEditing ? "حفظ التغييرات" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
