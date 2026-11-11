"use client";

import * as React from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import {
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/firestore/notifications";
import { cn } from "@/lib/utils";
import type { UserNotification } from "@/types";
import { Button } from "@/components/ui/button";

import { useReviewNotifications } from "./review-notifications-provider";
import { NotificationItem } from "./notification-item";

type NotificationCenterProps = {
  isOpen: boolean;
  onClose: () => void;
  presentation: "menu" | "plain";
  className?: string;
};

function isSafeInternalPath(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

function logDevelopmentError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(message, error);
  }
}

export function NotificationCenter({
  isOpen,
  onClose,
  presentation,
  className,
}: NotificationCenterProps) {
  const { user } = useAuth();
  const router = useRouter();
  const {
    unreadCount,
    refreshUnreadCount,
    decrementUnreadCount,
    clearUnreadCount,
  } = useReviewNotifications();
  const [notifications, setNotifications] = React.useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const [pendingNotificationId, setPendingNotificationId] = React.useState<string | null>(
    null
  );

  const loadNotifications = React.useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    setLoadError(false);

    try {
      setNotifications(await listUserNotifications(user.uid));
    } catch (error) {
      logDevelopmentError("Unable to load in-app notifications.", error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (isOpen) {
      void loadNotifications();
    }
  }, [isOpen, loadNotifications, unreadCount]);

  const handleNotificationSelect = React.useCallback(
    async (notification: UserNotification) => {
      setPendingNotificationId(notification.id);

      try {
        if (!notification.isRead) {
          await markNotificationRead(notification);
          setNotifications((currentNotifications) =>
            currentNotifications.map((currentNotification) =>
              currentNotification.id === notification.id
                ? { ...currentNotification, isRead: true }
                : currentNotification
            )
          );
          decrementUnreadCount();
          void refreshUnreadCount();
        }
      } catch (error) {
        logDevelopmentError("Unable to mark a notification as read.", error);
        toast.error("تعذر تعليم الإشعار كمقروء.");
      } finally {
        setPendingNotificationId(null);
      }

      onClose();

      if (isSafeInternalPath(notification.url)) {
        router.push(notification.url);
      }
    },
    [decrementUnreadCount, onClose, refreshUnreadCount, router]
  );

  const hasUnreadNotifications =
    unreadCount > 0 || notifications.some((notification) => !notification.isRead);

  const handleMarkAllRead = React.useCallback(async () => {
    if (!user || !hasUnreadNotifications || isMarkingAll) {
      return;
    }

    setIsMarkingAll(true);

    try {
      await markAllNotificationsRead(user.uid);
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );
      clearUnreadCount();
      void refreshUnreadCount();
    } catch (error) {
      logDevelopmentError("Unable to mark all notifications as read.", error);
      toast.error("تعذر تعليم الإشعارات كمقروءة.");
    } finally {
      setIsMarkingAll(false);
    }
  }, [
    clearUnreadCount,
    hasUnreadNotifications,
    isMarkingAll,
    refreshUnreadCount,
    user,
  ]);

  return (
    <section className={cn("flex min-h-0 flex-col", className)} aria-label="الإشعارات">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">الإشعارات</h2>
        {hasUnreadNotifications ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isMarkingAll}
            onClick={() => void handleMarkAllRead()}
          >
            <CheckCheck className="size-3.5" />
            {isMarkingAll ? "جارٍ التعليم..." : "تعليم الكل كمقروء"}
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 overflow-y-auto p-1.5">
        {isLoading ? (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">
            جارٍ تحميل الإشعارات...
          </p>
        ) : loadError ? (
          <div className="space-y-3 px-3 py-5 text-center">
            <p className="text-sm text-muted-foreground">تعذر تحميل الإشعارات.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadNotifications()}
            >
              <RefreshCw className="size-3.5" />
              إعادة المحاولة
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">
            لا توجد إشعارات حاليًا.
          </p>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isPending={pendingNotificationId === notification.id}
                presentation={presentation}
                onSelect={handleNotificationSelect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
