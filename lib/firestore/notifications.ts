import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { UserNotification } from "@/types";

import { firestoreCollections } from "./collections";

const NOTIFICATION_LIST_LIMIT = 20;
const BATCH_WRITE_LIMIT = 500;

function getNotificationsCollection() {
  return collection(db, firestoreCollections.userNotifications);
}

function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function getUnreadNotificationCount(userId: string) {
  const unreadNotifications = query(
    getNotificationsCollection(),
    where("userId", "==", userId),
    where("isRead", "==", false)
  );
  const result = await getCountFromServer(unreadNotifications);

  return result.data().count;
}

export async function listUserNotifications(userId: string) {
  const notifications = query(
    getNotificationsCollection(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(NOTIFICATION_LIST_LIMIT)
  );
  const snapshot = await getDocs(notifications);

  return snapshot.docs.map(
    (notification) =>
      ({
        ...notification.data(),
        id: notification.id,
      }) as UserNotification
  );
}

export async function markNotificationRead(
  notification: Pick<UserNotification, "id" | "isRead">
) {
  if (notification.isRead) {
    return false;
  }

  await updateDoc(
    doc(db, firestoreCollections.userNotifications, notification.id),
    {
      isRead: true,
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return true;
}

export async function markAllNotificationsRead(userId: string) {
  const unreadNotifications = query(
    getNotificationsCollection(),
    where("userId", "==", userId),
    where("isRead", "==", false)
  );
  const snapshot = await getDocs(unreadNotifications);

  for (const notificationsChunk of chunk(snapshot.docs, BATCH_WRITE_LIMIT)) {
    const batch = writeBatch(db);

    for (const notification of notificationsChunk) {
      batch.update(notification.ref, {
        isRead: true,
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  return snapshot.size;
}
