"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import { setPassageWeak } from "@/lib/firestore/user-passage-states";
import type { Passage } from "@/types";

export function WeakPassageButton({
  userId,
  passage,
  isWeak,
  onWeakChange,
}: {
  userId: string;
  passage: Pick<Passage, "id" | "matnId" | "isActive" | "isArchived">;
  isWeak: boolean;
  onWeakChange: (passageId: string, isWeak: boolean) => void;
}) {
  const [isSaving, setIsSaving] = React.useState(false);

  async function toggleWeakState() {
    if (isSaving || !passage.isActive || passage.isArchived) {
      return;
    }

    const nextIsWeak = !isWeak;
    setIsSaving(true);

    try {
      await setPassageWeak({
        userId,
        passageId: passage.id,
        matnId: passage.matnId,
        isWeak: nextIsWeak,
      });
      onWeakChange(passage.id, nextIsWeak);
      toast.success(
        nextIsWeak ? "تم تعليم المقطع كضعيف." : "تمت إزالة علامة الضعف."
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to update the passage weakness state.", error);
      }

      toast.error(getFirestoreErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Button
      type="button"
      variant={isWeak ? "secondary" : "ghost"}
      size="sm"
      disabled={isSaving}
      onClick={() => void toggleWeakState()}
      aria-pressed={isWeak}
    >
      <CircleAlert />
      {isWeak ? "إزالة الضعف" : "ضعيف"}
    </Button>
  );
}
