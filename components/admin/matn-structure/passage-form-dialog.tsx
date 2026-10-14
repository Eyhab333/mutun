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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PassageInput } from "@/lib/firestore/matn-structure";
import type { Passage } from "@/types";

export type PassageEditor = {
  item?: Passage;
};

type PassageFormDialogProps = {
  editor: PassageEditor | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PassageInput) => void;
};

export function PassageFormDialog({
  editor,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: PassageFormDialogProps) {
  const [text, setText] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [validationMessage, setValidationMessage] = React.useState("");
  const isEditing = Boolean(editor?.item);

  React.useEffect(() => {
    setText(editor?.item?.text ?? "");
    setIsActive(editor?.item?.isActive ?? true);
    setValidationMessage("");
  }, [editor]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      setValidationMessage("نص المقطع مطلوب.");
      return;
    }

    setValidationMessage("");
    onSubmit({ text: trimmedText, isActive });
  }

  return (
    <Dialog open={Boolean(editor)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "تعديل المقطع" : "إضافة مقطع"}</DialogTitle>
          <DialogDescription>
            يُضاف المقطع الجديد في نهاية الترتيب الحالي، ويمكن إعادة ترتيبه بالسحب لاحقًا.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="passage-text">النص</Label>
            <Textarea
              id="passage-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={isSubmitting}
              rows={6}
              autoFocus
              aria-invalid={Boolean(validationMessage) || undefined}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="passage-active">نشط</Label>
            <Switch
              id="passage-active"
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
