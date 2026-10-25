import { createHash } from "node:crypto";

import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  FieldValue,
  Timestamp,
  type DocumentReference,
} from "firebase-admin/firestore";
import type { FidMulticastMessage } from "firebase-admin/messaging";

import { adminDb, adminMessaging } from "./firebase-admin.js";

const REVIEW_GROUPS_COLLECTION = "reviewGroups";
const FCM_REGISTRATIONS_COLLECTION = "fcmRegistrations";
const FCM_INSTALLATIONS_COLLECTION = "installations";
const REVIEW_NOTIFICATION_RECEIPTS_COLLECTION = "reviewNotificationReceipts";
const MAX_FIDS_PER_BATCH = 500;
const RECEIPT_CLAIM_DURATION_MS = 25 * 60 * 1000;

type DueReviewGroup = {
  id: string;
  userId: string;
  nextReviewAt: Timestamp;
  reference: DocumentReference;
};

type FcmInstallation = {
  fid: string;
  reference: DocumentReference;
};

type ClaimedReviewGroup = DueReviewGroup & {
  receiptReference: DocumentReference;
};

function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

function isSameTimestamp(first: Timestamp, second: unknown) {
  return (
    isTimestamp(second) &&
    first.seconds === second.seconds &&
    first.nanoseconds === second.nanoseconds
  );
}

function createReceiptId(group: Pick<DueReviewGroup, "id" | "userId" | "nextReviewAt">) {
  const dueAt = `${group.nextReviewAt.seconds}:${group.nextReviewAt.nanoseconds}`;
  const digest = createHash("sha256")
    .update(`${group.userId}\u0000${group.id}\u0000${dueAt}`)
    .digest("hex");

  return `review-${digest}`;
}

function isReceiptClaimStillActive(data: Record<string, unknown>, now: Timestamp) {
  return data.status === "claimed" && isTimestamp(data.claimExpiresAt)
    ? data.claimExpiresAt.toMillis() > now.toMillis()
    : false;
}

function isPermanentlyInvalidFidError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  return (
    code === "messaging/installation-id-not-registered" ||
    code === "messaging/invalid-recipient"
  );
}

function getNotificationBody(dueCount: number) {
  return dueCount > 1
    ? `لديك ${dueCount} مجموعات جاهزة للمراجعة.`
    : "لديك مراجعة مستحقة الآن.";
}

async function listDueReviewGroups() {
  const snapshot = await adminDb
    .collection(REVIEW_GROUPS_COLLECTION)
    .where("isActive", "==", true)
    .where("nextReviewAt", "<=", Timestamp.now())
    .get();

  return snapshot.docs.flatMap((document) => {
    const data = document.data();

    return typeof data.userId === "string" && isTimestamp(data.nextReviewAt)
      ? [
          {
            id: document.id,
            userId: data.userId,
            nextReviewAt: data.nextReviewAt,
            reference: document.ref,
          } satisfies DueReviewGroup,
        ]
      : [];
  });
}

async function listActiveFcmInstallations(userId: string) {
  const snapshot = await adminDb
    .collection(FCM_REGISTRATIONS_COLLECTION)
    .doc(userId)
    .collection(FCM_INSTALLATIONS_COLLECTION)
    .where("enabled", "==", true)
    .get();

  return snapshot.docs.flatMap((document) => {
    const data = document.data();

    return data.userId === userId && data.installationId === document.id
      ? [{ fid: document.id, reference: document.ref } satisfies FcmInstallation]
      : [];
  });
}

async function claimDueReviewGroups(groups: readonly DueReviewGroup[]) {
  if (groups.length === 0) {
    return [];
  }

  return adminDb.runTransaction(async (transaction) => {
    const now = Timestamp.now();
    const claimExpiresAt = Timestamp.fromMillis(
      now.toMillis() + RECEIPT_CLAIM_DURATION_MS
    );
    const entries = await Promise.all(
      groups.map(async (group) => {
        const receiptReference = adminDb
          .collection(REVIEW_NOTIFICATION_RECEIPTS_COLLECTION)
          .doc(createReceiptId(group));
        const [reviewGroup, receipt] = await Promise.all([
          transaction.get(group.reference),
          transaction.get(receiptReference),
        ]);

        return { group, receiptReference, reviewGroup, receipt };
      })
    );
    const claimed: ClaimedReviewGroup[] = [];

    for (const entry of entries) {
      const currentGroup = entry.reviewGroup.data();

      if (
        !entry.reviewGroup.exists ||
        currentGroup?.isActive !== true ||
        !isSameTimestamp(entry.group.nextReviewAt, currentGroup?.nextReviewAt)
      ) {
        continue;
      }

      if (entry.receipt.exists) {
        const receipt = entry.receipt.data() ?? {};

        if (
          receipt.status === "sent" ||
          isReceiptClaimStillActive(receipt, now)
        ) {
          continue;
        }
      }

      transaction.set(
        entry.receiptReference,
        {
          userId: entry.group.userId,
          reviewGroupId: entry.group.id,
          nextReviewAt: entry.group.nextReviewAt,
          status: "claimed",
          claimedAt: FieldValue.serverTimestamp(),
          claimExpiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      claimed.push({
        ...entry.group,
        receiptReference: entry.receiptReference,
      });
    }

    return claimed;
  });
}

async function markReceiptsSent(groups: readonly ClaimedReviewGroup[]) {
  for (const receiptChunk of chunk(groups, MAX_FIDS_PER_BATCH)) {
    const batch = adminDb.batch();

    for (const group of receiptChunk) {
      batch.update(group.receiptReference, {
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
  }
}

async function releaseReceiptClaims(groups: readonly ClaimedReviewGroup[]) {
  for (const receiptChunk of chunk(groups, MAX_FIDS_PER_BATCH)) {
    const batch = adminDb.batch();

    for (const group of receiptChunk) {
      batch.delete(group.receiptReference);
    }

    await batch.commit();
  }
}

async function disableInvalidInstallations(
  installations: readonly FcmInstallation[]
) {
  for (const installationChunk of chunk(installations, MAX_FIDS_PER_BATCH)) {
    const batch = adminDb.batch();

    for (const installation of installationChunk) {
      batch.update(installation.reference, {
        enabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
  }
}

async function sendReviewDueNotification(
  installations: readonly FcmInstallation[],
  dueCount: number
) {
  const invalidInstallations: FcmInstallation[] = [];
  let successCount = 0;

  for (const installationChunk of chunk(installations, MAX_FIDS_PER_BATCH)) {
    const message: FidMulticastMessage = {
      fids: installationChunk.map((installation) => installation.fid),
      data: {
        type: "REVIEW_DUE",
        url: "/review",
        dueCount: String(dueCount),
      },
      webpush: {
        headers: {
          TTL: "1800",
        },
      },
    };
    const response = await adminMessaging.sendEachForMulticast(message);

    response.responses.forEach((result, index) => {
      if (result.success) {
        successCount += 1;
      } else if (isPermanentlyInvalidFidError(result.error)) {
        invalidInstallations.push(installationChunk[index]);
      }
    });
  }

  return { successCount, invalidInstallations };
}

async function notifyUser(
  userId: string,
  dueGroups: readonly DueReviewGroup[]
) {
  const installations = await listActiveFcmInstallations(userId);

  if (installations.length === 0) {
    return;
  }

  const claimedGroups = await claimDueReviewGroups(dueGroups);

  if (claimedGroups.length === 0) {
    return;
  }

  try {
    const result = await sendReviewDueNotification(
      installations,
      dueGroups.length
    );

    if (result.invalidInstallations.length > 0) {
      await disableInvalidInstallations(result.invalidInstallations);
    }

    if (result.successCount > 0) {
      await markReceiptsSent(claimedGroups);
      return;
    }

    await releaseReceiptClaims(claimedGroups);
  } catch (error) {
    logger.error("Unable to send a due review notification.", error);
    await releaseReceiptClaims(claimedGroups);
  }
}

export const sendDueReviewNotifications = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "Africa/Cairo",
  },
  async () => {
    const dueGroups = await listDueReviewGroups();
    const groupsByUser = new Map<string, DueReviewGroup[]>();

    for (const group of dueGroups) {
      const userGroups = groupsByUser.get(group.userId) ?? [];
      userGroups.push(group);
      groupsByUser.set(group.userId, userGroups);
    }

    for (const [userId, userGroups] of groupsByUser) {
      await notifyUser(userId, userGroups);
    }
  }
);
