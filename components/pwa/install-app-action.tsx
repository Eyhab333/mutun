"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { usePwaInstall } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type InstallAppActionProps = {
  className?: string;
  labelClassName?: string;
};

export function InstallAppAction({
  className,
  labelClassName,
}: InstallAppActionProps) {
  const { canInstall, promptInstall, showIosInstallHint } = usePwaInstall();
  const [isIosDialogOpen, setIsIosDialogOpen] = React.useState(false);

  if (!canInstall && !showIosInstallHint) {
    return null;
  }

  function handleInstall() {
    if (canInstall) {
      void promptInstall();
      return;
    }

    setIsIosDialogOpen(true);
  }

  return (
    <Dialog open={isIosDialogOpen} onOpenChange={setIsIosDialogOpen}>
      <Button
        type="button"
        variant="ghost"
        className={cn("w-full justify-start", className)}
        onClick={handleInstall}
      >
        <Download className="size-4" />
        <span className={labelClassName}>تثبيت التطبيق</span>
      </Button>

      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تثبيت المتون</DialogTitle>
          <DialogDescription>
            من Safari، افتح زر المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية».
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إغلاق</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
