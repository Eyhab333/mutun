import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

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

export async function upsertFcmInstallation({
  userId,
  installationId,
  userAgent,
}: UpsertFcmInstallationInput) {
  const reference = getInstallationReference(userId, installationId);
  const existing = await getDoc(reference);

  await setDoc(
    reference,
    {
      installationId,
      userId,
      enabled: true,
      ...(userAgent ? { userAgent } : {}),
      ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
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
  const reference = getInstallationReference(userId, installationId);
  const existing = await getDoc(reference);

  if (!existing.exists()) {
    return;
  }

  await updateDoc(reference, {
    enabled: false,
    updatedAt: serverTimestamp(),
  });
}
