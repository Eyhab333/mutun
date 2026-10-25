import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const adminApp = getApps()[0] ?? initializeApp();

export const adminDb = getFirestore(adminApp);
export const adminMessaging = getMessaging(adminApp);
