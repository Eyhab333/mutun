"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Book, BookCollection, BookType } from "@/types";

export type BookFormValues = {
  title: string;
  author?: string;
  description?: string;
  type: BookType;
  collectionId?: string;
  isActive: boolean;
  file: File | null;
};

export function BookFormDialog({
  item,
  collections,
  initialCollectionId,
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  item: Book | null;
  collections: readonly BookCollection[];
  initialCollectionId: string | null;
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BookFormValues) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<BookType>("TEXT");
  const [collectionId, setCollectionId] = React.useState<string>("");
  const [isActive, setIsActive] = React.useState(true);
  const [file, setFile] = React.useState<File | null>(null);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setTitle(item?.title ?? ""); setAuthor(item?.author ?? ""); setDescription(item?.description ?? ""); setType(item?.type ?? "TEXT"); setCollectionId(item?.collectionId ?? initialCollectionId ?? ""); setIsActive(item?.isActive ?? true); setFile(null); setMessage("");
  }, [initialCollectionId, item, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) { setMessage("عنوان الكتاب مطلوب."); return; }
    if (type === "PDF" && !item && !file) { setMessage("اختر ملف PDF للكتاب."); return; }
    setMessage("");
    onSubmit({ title: title.trim(), ...(author.trim() ? { author: author.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}), type, ...(collectionId ? { collectionId } : {}), isActive, file });
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={!isSubmitting} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>{item ? "تعديل الكتاب" : "إضافة كتاب"}</DialogTitle><DialogDescription>{item ? "بيانات الكتاب الأساسية وإتاحته للقراء." : "حدّد نوع الكتاب ثم أضف بياناته."}</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2"><Label htmlFor="book-title">العنوان</Label><Input id="book-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={isSubmitting} autoFocus /></div>
        <div className="grid gap-2"><Label htmlFor="book-author">المؤلف (اختياري)</Label><Input id="book-author" value={author} onChange={(event) => setAuthor(event.target.value)} disabled={isSubmitting} /></div>
        <div className="grid gap-2"><Label htmlFor="book-description">الوصف (اختياري)</Label><Textarea id="book-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSubmitting} /></div>
        <div className="grid gap-2"><Label>مجموعة الكتب</Label><Select value={collectionId || "__direct__"} onValueChange={(value) => setCollectionId(value === "__direct__" ? "" : String(value))}><SelectTrigger className="w-full"><SelectValue placeholder="مباشرة تحت العلم" /></SelectTrigger><SelectContent><SelectItem value="__direct__">مباشرة تحت العلم</SelectItem>{collections.filter((collection) => !collection.isArchived).map((collection) => <SelectItem key={collection.id} value={collection.id}>{collection.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>نوع الكتاب</Label>{item ? <p className="text-sm text-muted-foreground">{type === "PDF" ? "PDF" : "نصي"}</p> : <Select value={type} onValueChange={(value) => setType(value as BookType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">نصي</SelectItem><SelectItem value="PDF">PDF</SelectItem></SelectContent></Select>}</div>
        {type === "PDF" ? <div className="grid gap-2"><Label htmlFor="book-pdf">{item ? "استبدال ملف PDF (اختياري)" : "ملف PDF"}</Label><Input id="book-pdf" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={isSubmitting} /><p className="text-xs leading-5 text-muted-foreground">PDF فقط، حتى 200 MB.</p></div> : null}
        <div className="flex items-center justify-between gap-3"><Label htmlFor="book-active">نشط</Label><Switch id="book-active" checked={isActive} onCheckedChange={setIsActive} disabled={isSubmitting} /></div>
        {message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="animate-spin" /> : null}{item ? "حفظ التغييرات" : "إنشاء الكتاب"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
