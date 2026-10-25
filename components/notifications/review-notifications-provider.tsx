"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import {
  createReviewMessagingConnection,
  getReviewMessagingAvailability,
  type ReviewMessagingAvailability,
} from "@/lib/fcm/review-notifications";

type ReviewNotificationStatus =
  | "loading"
  | NotificationPermission
  | Exclude<ReviewMessagingAvailability, "supported">
  | "error";

type ReviewNotificationsContextValue = {
  status: ReviewNotificationStatus;
  isEnabling: boolean;
  enableReviewNotifications: () => Promise<void>;
};

type MessagingConnection = Awaited<
  ReturnType<typeof createReviewMessagingConnection>
>;

export const ReviewNotificationsContext =
  React.createContext<ReviewNotificationsContextValue | null>(null);

function logDevelopmentError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(message, error);
  }
}

function getPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export function ReviewNotificationsProvider({
  children,
}: React.PropsWithChildren) {
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = React.useState<ReviewNotificationStatus>("loading");
  const [isEnabling, setIsEnabling] = React.useState(false);
  const connectionRef = React.useRef<{
    userId: string;
    connection: MessagingConnection;
  } | null>(null);

  const handleReviewDue = React.useCallback(() => {
    toast.info("حان وقت المراجعة", {
      action: {
        label: "فتح المراجعة",
        onClick: () => router.push("/review"),
      },
    });
  }, [router]);

  const disposeConnection = React.useCallback(() => {
    connectionRef.current?.connection.dispose();
    connectionRef.current = null;
  }, []);

  const ensureConnection = React.useCallback(async () => {
    if (!user) {
      throw new Error("An authenticated user is required for FCM.");
    }

    if (connectionRef.current?.userId === user.uid) {
      return connectionRef.current.connection;
    }

    disposeConnection();
    const connection = await createReviewMessagingConnection({
      userId: user.uid,
      onReviewDue: handleReviewDue,
    });

    connectionRef.current = { userId: user.uid, connection };
    return connection;
  }, [disposeConnection, handleReviewDue, user]);

  React.useEffect(() => {
    let isCurrent = true;

    async function connectExistingPermission() {
      const availability = await getReviewMessagingAvailability();

      if (!isCurrent) {
        return;
      }

      if (availability !== "supported") {
        disposeConnection();
        setStatus(availability);
        return;
      }

      const permission = getPermissionStatus();
      setStatus(permission);

      if (!user || permission !== "granted") {
        disposeConnection();
        return;
      }

      try {
        const connection = await ensureConnection();

        if (!isCurrent) {
          if (connectionRef.current?.connection === connection) {
            connection.dispose();
            connectionRef.current = null;
          }

          return;
        }

        await connection.register();
      } catch (error) {
        logDevelopmentError("Unable to refresh the FCM registration.", error);

        if (isCurrent) {
          setStatus("error");
        }
      }
    }

    void connectExistingPermission();

    return () => {
      isCurrent = false;
      disposeConnection();
    };
  }, [disposeConnection, ensureConnection, user]);

  const enableReviewNotifications = React.useCallback(async () => {
    if (isEnabling || !user) {
      return;
    }

    const availability = await getReviewMessagingAvailability();

    if (availability === "unsupported") {
      setStatus("unsupported");
      toast.error("الإشعارات غير مدعومة في هذا المتصفح.");
      return;
    }

    if (availability === "missing-vapid") {
      setStatus("missing-vapid");
      toast.error("يلزم إعداد مفتاح إشعارات التطبيق أولًا.");
      return;
    }

    const currentPermission = getPermissionStatus();

    if (currentPermission === "denied") {
      setStatus("denied");
      toast.error("حُظرت الإشعارات من إعدادات المتصفح.");
      return;
    }

    setIsEnabling(true);

    try {
      const permission = await Notification.requestPermission();
      setStatus(permission);

      if (permission !== "granted") {
        toast.error("لم يتم منح إذن الإشعارات.");
        return;
      }

      const connection = await ensureConnection();
      await connection.register();
      toast.success("تم تفعيل إشعارات المراجعة.");
    } catch (error) {
      logDevelopmentError("Unable to enable review notifications.", error);
      setStatus("error");
      toast.error("تعذر تفعيل إشعارات المراجعة.");
    } finally {
      setIsEnabling(false);
    }
  }, [ensureConnection, isEnabling, user]);

  const value = React.useMemo<ReviewNotificationsContextValue>(
    () => ({
      status,
      isEnabling,
      enableReviewNotifications,
    }),
    [enableReviewNotifications, isEnabling, status]
  );

  return (
    <ReviewNotificationsContext.Provider value={value}>
      {children}
    </ReviewNotificationsContext.Provider>
  );
}

export function useReviewNotifications() {
  const context = React.useContext(ReviewNotificationsContext);

  if (!context) {
    throw new Error(
      "useReviewNotifications must be used within ReviewNotificationsProvider."
    );
  }

  return context;
}
