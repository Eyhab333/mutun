"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getFirestoreErrorMessage } from "@/lib/firestore/content";
import { addPassageToToday } from "@/lib/firestore/user-active-passages";
import type { Passage } from "@/types";

export function AddToTodayButton({
  userId,
  passage,
  isAdded,
  isChecking,
  isUnavailable,
  onAdded,
}: {
  userId: string;
  passage: Pick<Passage, "id" | "matnId" | "isActive" | "isArchived">;
  isAdded: boolean;
  isChecking: boolean;
  isUnavailable: boolean;
  onAdded: (passageId: string) => void;
}) {
  const [isAdding, setIsAdding] = React.useState(false);

  async function addToToday() {
    if (isAdding || isAdded || !passage.isActive || passage.isArchived) {
      return;
    }

    setIsAdding(true);

    try {
      const result = await addPassageToToday(userId, passage.id, passage.matnId);
      onAdded(passage.id);

      if (result !== "already-active") {
        toast.success("تمت الإضافة إلى اليوم.");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to add passage to Today.", error);
      }

      toast.error(getFirestoreErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  if (isChecking) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled>
        جارٍ التحقق...
      </Button>
    );
  }

  if (isUnavailable) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled>
        تعذر التحقق من الحالة
      </Button>
    );
  }

  if (isAdded) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled>
        <Check />
        مضاف لليوم
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void addToToday()}
      disabled={isAdding}
    >
      <Plus />
      إضافة إلى اليوم
    </Button>
  );
}
