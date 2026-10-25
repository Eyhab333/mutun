export const firestoreCollections = {
  levels: "levels",
  sciences: "sciences",
  matn: "matn",
  maqasid: "maqasid",
  chapters: "chapters",
  sections: "sections",
  passages: "passages",
  passageResources: "passageResources",
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
} as const;

export const fcmInstallationsCollection = "installations";

export type FirestoreCollectionName =
  (typeof firestoreCollections)[keyof typeof firestoreCollections];
