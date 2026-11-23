"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BookCollection } from "@/types";

export type BookCollectionFormValues = { title: string; description?: string; isActive: boolean };

export function BookCollectionFormDialog({
  item,
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  item: BookCollection | null;
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BookCollectionFormValues) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setIsActive(item?.isActive ?? true);
    setMessage("");
  }, [item, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) { setMessage("عنوان المجموعة مطلوب."); return; }
    setMessage("");
    onSubmit({ title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}), isActive });
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={!isSubmitting} className="sm:max-w-md">
      <DialogHeader><DialogTitle>{item ? "تعديل مجموعة الكتب" : "إضافة مجموعة كتب"}</DialogTitle><DialogDescription>تُضاف المجموعة الجديدة في نهاية ترتيب العلم الحالي.</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2"><Label htmlFor="book-collection-title">العنوان</Label><Input id="book-collection-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={isSubmitting} autoFocus /></div>
        <div className="grid gap-2"><Label htmlFor="book-collection-description">الوصف (اختياري)</Label><Textarea id="book-collection-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSubmitting} /></div>
        <div className="flex items-center justify-between gap-3"><Label htmlFor="book-collection-active">نشطة</Label><Switch id="book-collection-active" checked={isActive} onCheckedChange={setIsActive} disabled={isSubmitting} /></div>
        {message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="animate-spin" /> : null}{item ? "حفظ التغييرات" : "إضافة"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
