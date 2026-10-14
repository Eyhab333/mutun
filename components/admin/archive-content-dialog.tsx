"use client";

import { Archive, ArchiveRestore, LoaderCircle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ArchiveContentDialogProps = {
  itemName: string | null;
  isArchived: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ArchiveContentDialog({
  itemName,
  isArchived,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: ArchiveContentDialogProps) {
  const actionLabel = isArchived ? "استعادة" : "أرشفة";

  return (
    <AlertDialog open={Boolean(itemName)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {isArchived ? <ArchiveRestore /> : <Archive />}
          </AlertDialogMedia>
          <AlertDialogTitle>{actionLabel} العنصر</AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? `سيعود «${itemName}» إلى القائمة النشطة.`
              : `سيُخفى «${itemName}» من القوائم النشطة دون حذف بياناته.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant={isArchived ? "default" : "destructive"}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
