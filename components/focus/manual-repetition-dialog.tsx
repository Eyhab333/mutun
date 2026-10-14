"use client";

import * as React from "react";

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

type ManualRepetitionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (count: number) => void;
  description?: string;
};

export function ManualRepetitionDialog({
  open,
  onOpenChange,
  onAdd,
  description = "أضف التكرارات التي أجريتها خارج التطبيق إلى عداد اليوم الحالي.",
}: ManualRepetitionDialogProps) {
  const [value, setValue] = React.useState("");
  const [validationMessage, setValidationMessage] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setValue("");
      setValidationMessage("");
    }
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^[1-9]\d*$/.test(value)) {
      setValidationMessage("أدخل عددًا صحيحًا موجبًا.");
      return;
    }

    const count = Number(value);

    if (!Number.isSafeInteger(count) || count <= 0) {
      setValidationMessage("أدخل عددًا صحيحًا موجبًا.");
      return;
    }

    onAdd(count);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>إضافة تكرارات يدوية</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="manual-repetition-count">عدد التكرارات</Label>
            <Input
              id="manual-repetition-count"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={Boolean(validationMessage) || undefined}
            />
            {validationMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {validationMessage}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit">إضافة</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
