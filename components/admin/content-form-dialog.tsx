"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Level, Matn, MatnType, Science } from "@/types";

export type ContentEntity = "level" | "science" | "matn";

export type ContentEditor = {
  entity: ContentEntity;
  item?: Level | Science | Matn;
};

export type ContentFormValues = {
  name: string;
  order: number;
  isActive: boolean;
  description?: string;
  type: MatnType;
  hasMaqasid: boolean;
  hasChapters: boolean;
  hasSections: boolean;
};

type ContentFormDialogProps = {
  editor: ContentEditor | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ContentFormValues) => void;
};

const entityLabels: Record<ContentEntity, string> = {
  level: "المستوى",
  science: "العلم",
  matn: "المتن",
};

export function ContentFormDialog({
  editor,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: ContentFormDialogProps) {
  const [name, setName] = React.useState("");
  const [order, setOrder] = React.useState("0");
  const [isActive, setIsActive] = React.useState(true);
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<MatnType>("PROSE");
  const [hasMaqasid, setHasMaqasid] = React.useState(false);
  const [hasChapters, setHasChapters] = React.useState(false);
  const [hasSections, setHasSections] = React.useState(false);
  const [validationMessage, setValidationMessage] = React.useState("");

  React.useEffect(() => {
    const item = editor?.item;

    setName(item?.name ?? "");
    setOrder(String(item?.order ?? 0));
    setIsActive(item?.isActive ?? true);
    setDescription(item && "description" in item ? item.description ?? "" : "");
    setType(item && "type" in item ? item.type : "PROSE");
    setHasMaqasid(item && "hasMaqasid" in item ? item.hasMaqasid : false);
    setHasChapters(item && "hasChapters" in item ? item.hasChapters : false);
    setHasSections(item && "hasSections" in item ? item.hasSections : false);
    setValidationMessage("");
  }, [editor]);

  const entity = editor?.entity ?? "level";
  const isMatn = entity === "matn";
  const isEditing = Boolean(editor?.item);
  const label = entityLabels[entity];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const parsedOrder = Number(order);

    if (!trimmedName) {
      setValidationMessage(`اسم ${label} مطلوب.`);
      return;
    }

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setValidationMessage("الترتيب يجب أن يكون عددًا صحيحًا غير سالب.");
      return;
    }

    setValidationMessage("");
    onSubmit({
      name: trimmedName,
      order: parsedOrder,
      isActive,
      description: description.trim() || undefined,
      type,
      hasMaqasid,
      hasChapters,
      hasSections,
    });
  }

  return (
    <Dialog open={Boolean(editor)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `تعديل ${label}` : `إضافة ${label}`}
          </DialogTitle>
          <DialogDescription>
            {isMatn
              ? "تُحفظ البنية الداخلية للمتن لتُدار في مرحلة لاحقة."
              : "يمكن تعديل هذه البيانات أو أرشفتها لاحقًا."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="content-name">الاسم</Label>
            <Input
              id="content-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              autoFocus
              aria-invalid={Boolean(validationMessage) || undefined}
            />
          </div>

          {isMatn ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="content-description">الوصف (اختياري)</Label>
                <Textarea
                  id="content-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label>النوع</Label>
                <Select
                  value={type}
                  onValueChange={(value) => {
                    if (value === "PROSE" || value === "POETRY") {
                      setType(value);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROSE">نثر</SelectItem>
                    <SelectItem value="POETRY">شعر</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
                <SwitchField
                  id="has-maqasid"
                  label="هل يحتوي على مقاصد؟"
                  checked={hasMaqasid}
                  onCheckedChange={setHasMaqasid}
                  disabled={isSubmitting}
                />
                <SwitchField
                  id="has-chapters"
                  label="هل يحتوي على أبواب؟"
                  checked={hasChapters}
                  onCheckedChange={setHasChapters}
                  disabled={isSubmitting}
                />
                <SwitchField
                  id="has-sections"
                  label="هل يحتوي على فصول؟"
                  checked={hasSections}
                  onCheckedChange={setHasSections}
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="content-order">الترتيب</Label>
            <Input
              id="content-order"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(validationMessage) || undefined}
            />
          </div>

          <SwitchField
            id="content-active"
            label="نشط"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isSubmitting}
          />

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

type SwitchFieldProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
};

function SwitchField({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: SwitchFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
