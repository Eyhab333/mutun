import {
  collection,
  documentId,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

import { fcmInstallationsCollection, firestoreCollections } from "./collections";

type UpsertFcmInstallationInput = {
  userId: string;
  installationId: string;
  userAgent?: string;
};

function getInstallationReference(userId: string, installationId: string) {
  return doc(
    db,
    firestoreCollections.fcmRegistrations,
    userId,
    fcmInstallationsCollection,
    installationId
  );
}

function getInstallationsCollection(userId: string) {
  return collection(
    db,
    firestoreCollections.fcmRegistrations,
    userId,
    fcmInstallationsCollection
  );
}

function getAuthenticatedUserId(userId: string) {
  const authenticatedUserId = auth.currentUser?.uid;

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    throw new Error("FCM installation user does not match the authenticated user.");
  }

  return authenticatedUserId;
}

function logInstallationWrite(
  reference: ReturnType<typeof getInstallationReference>,
  userId: string,
  installationId: string,
  fields: readonly string[]
) {
  if (process.env.NODE_ENV === "development") {
    console.info("Saving FCM installation.", {
      uid: userId,
      installationId,
      documentPath: reference.path,
      fields,
    });
  }
}

async function installationDocumentExists(userId: string, installationId: string) {
  const snapshot = await getDocs(
    query(
      getInstallationsCollection(userId),
      where("userId", "==", userId),
      where(documentId(), "==", installationId),
      limit(1)
    )
  );

  return !snapshot.empty;
}

export async function upsertFcmInstallation({
  userId,
  installationId,
  userAgent,
}: UpsertFcmInstallationInput) {
  const authenticatedUserId = getAuthenticatedUserId(userId);
  const reference = getInstallationReference(
    authenticatedUserId,
    installationId
  );
  const exists = await installationDocumentExists(
    authenticatedUserId,
    installationId
  );
  const fields = [
    "userId",
    "installationId",
    "enabled",
    ...(userAgent ? ["userAgent"] : []),
    ...(!exists ? ["createdAt"] : []),
    "updatedAt",
    "lastSeenAt",
  ];

  logInstallationWrite(
    reference,
    authenticatedUserId,
    installationId,
    fields
  );

  await setDoc(
    reference,
    {
      installationId,
      userId: authenticatedUserId,
      enabled: true,
      ...(userAgent ? { userAgent } : {}),
      ...(!exists ? { createdAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function disableFcmInstallation(
  userId: string,
  installationId: string
) {
  const authenticatedUserId = getAuthenticatedUserId(userId);
  const reference = getInstallationReference(
    authenticatedUserId,
    installationId
  );
  const exists = await installationDocumentExists(
    authenticatedUserId,
    installationId
  );

  if (!exists) {
    return;
  }

  logInstallationWrite(reference, authenticatedUserId, installationId, [
    "enabled",
    "updatedAt",
  ]);

  await updateDoc(reference, {
    enabled: false,
    updatedAt: serverTimestamp(),
  });
}
