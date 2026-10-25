"use client";

import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  onUnregistered,
  register,
  type MessagePayload,
} from "firebase/messaging";

import { registerMutunServiceWorker } from "@/components/pwa/service-worker-registration";
import {
  disableFcmInstallation,
  upsertFcmInstallation,
} from "@/lib/firestore/fcm-registrations";
import { firebaseApp } from "@/lib/firebase";

export type ReviewMessagingAvailability =
  | "supported"
  | "unsupported"
  | "missing-vapid";

type ReviewMessagingConnection = {
  register: () => Promise<void>;
  dispose: () => void;
};

type CreateReviewMessagingConnectionInput = {
  userId: string;
  onReviewDue: (payload: MessagePayload) => void;
};

function logDevelopmentError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(message, error);
  }
}

function getVapidKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? "";
}

function getUserAgent() {
  return typeof navigator === "undefined"
    ? undefined
    : navigator.userAgent.slice(0, 512);
}

export async function getReviewMessagingAvailability(): Promise<ReviewMessagingAvailability> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  if (!getVapidKey()) {
    return "missing-vapid";
  }

  try {
    return (await isSupported()) ? "supported" : "unsupported";
  } catch (error) {
    logDevelopmentError("Unable to check Firebase Messaging support.", error);
    return "unsupported";
  }
}

export async function createReviewMessagingConnection({
  userId,
  onReviewDue,
}: CreateReviewMessagingConnectionInput): Promise<ReviewMessagingConnection> {
  const availability = await getReviewMessagingAvailability();

  if (availability !== "supported") {
    throw new Error(`Review Messaging is ${availability}.`);
  }

  const serviceWorkerRegistration = await registerMutunServiceWorker();
  const messaging = getMessaging(firebaseApp);
  const registeredUnsubscribe = onRegistered(messaging, (installationId) => {
    void upsertFcmInstallation({
      userId,
      installationId,
      userAgent: getUserAgent(),
    }).catch((error) => {
      logDevelopmentError("Unable to save an FCM installation.", error);
    });
  });
  const unregisteredUnsubscribe = onUnregistered(messaging, (installationId) => {
    void disableFcmInstallation(userId, installationId).catch((error) => {
      logDevelopmentError("Unable to disable an FCM installation.", error);
    });
  });
  const messageUnsubscribe = onMessage(messaging, (payload) => {
    if (payload.data?.type === "REVIEW_DUE") {
      onReviewDue(payload);
    }
  });

  return {
    register: () =>
      register(messaging, {
        vapidKey: getVapidKey(),
        serviceWorkerRegistration,
      }),
    dispose: () => {
      registeredUnsubscribe();
      unregisteredUnsubscribe();
      messageUnsubscribe();
    },
  };
}
