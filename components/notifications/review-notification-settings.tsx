"use client";

import { BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReviewNotifications } from "./review-notifications-provider";

function getStatusMessage(status: ReturnType<typeof useReviewNotifications>["status"]) {
  switch (status) {
    case "granted":
      return "إشعارات المراجعة مفعّلة لهذا المتصفح.";
    case "denied":
      return "حُظرت الإشعارات. يمكنك تعديل الإذن من إعدادات المتصفح.";
    case "unsupported":
      return "الإشعارات غير مدعومة في هذا المتصفح.";
    case "missing-vapid":
      return "يلزم إعداد مفتاح Web Push قبل تفعيل الإشعارات.";
    case "error":
      return "تعذر الاتصال بخدمة الإشعارات حاليًا.";
    case "loading":
      return "جارٍ التحقق من دعم الإشعارات...";
    default:
      return "يمكنك تفعيل إشعار عند حلول وقت المراجعة.";
  }
}

export function ReviewNotificationSettings() {
  const { status, isEnabling, enableReviewNotifications } =
    useReviewNotifications();
  const canEnable =
    status === "default" || status === "error" || status === "loading";

  return (
    <section className="max-w-2xl rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            إشعارات المراجعة
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {getStatusMessage(status)}
          </p>
        </div>
      </div>

      {canEnable ? (
        <Button
          type="button"
          className="mt-4"
          disabled={isEnabling || status === "loading"}
          onClick={() => void enableReviewNotifications()}
        >
          <BellRing className="size-4" />
          {isEnabling ? "جارٍ التفعيل..." : "تفعيل إشعارات المراجعة"}
        </Button>
      ) : null}
    </section>
  );
}
