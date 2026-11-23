export const firestoreCollections = {
  levels: "levels",
  sciences: "sciences",
  matn: "matn",
  maqasid: "maqasid",
  chapters: "chapters",
  sections: "sections",
  passages: "passages",
  passageResources: "passageResources",
  bookCollections: "bookCollections",
  books: "books",
  bookPages: "bookPages",
  userPassageStates: "userPassageStates",
  userActivePassages: "userActivePassages",
  dailyRepetitions: "dailyRepetitions",
  userPassageStats: "userPassageStats",
  userMatnProgress: "userMatnProgress",
  reviewGroups: "reviewGroups",
  reviewRecords: "reviewRecords",
  repairRecords: "repairRecords",
  userSettings: "userSettings",
  fcmRegistrations: "fcmRegistrations",
  userNotifications: "userNotifications",
  bookReadingCycles: "bookReadingCycles",
  bookReadingDailyStats: "bookReadingDailyStats",
} as const;

export const fcmInstallationsCollection = "installations";

export type FirestoreCollectionName =
  (typeof firestoreCollections)[keyof typeof firestoreCollections];

/**
 * Resolves a registered top-level collection path before it reaches the
 * Firestore SDK. Collection names are application constants and may never be
 * an empty string.
 */
export function getFirestoreCollectionPath(
  name: keyof typeof firestoreCollections
) {
  const path = firestoreCollections[name];

  if (typeof path !== "string" || path.trim().length === 0) {
    throw new Error(`Missing Firestore collection path for "${name}".`);
  }

  return path;
}
