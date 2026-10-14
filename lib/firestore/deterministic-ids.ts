function encodeDocumentSegment(value: string) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getUserActivePassageDocumentId(userId: string, passageId: string) {
  return `u-${encodeDocumentSegment(userId)}__p-${encodeDocumentSegment(passageId)}`;
}

export function getDailyRepetitionDocumentId(
  userId: string,
  passageId: string,
  dateKey: string
) {
  return `u-${encodeDocumentSegment(userId)}__p-${encodeDocumentSegment(passageId)}__d-${encodeDocumentSegment(dateKey)}`;
}

export function getUserPassageStatsDocumentId(userId: string, passageId: string) {
  return `u-${encodeDocumentSegment(userId)}__p-${encodeDocumentSegment(passageId)}`;
}

export function getUserPassageStateDocumentId(userId: string, passageId: string) {
  return `u-${encodeDocumentSegment(userId)}__p-${encodeDocumentSegment(passageId)}`;
}

export function getUserMatnProgressDocumentId(userId: string, matnId: string) {
  return `u-${encodeDocumentSegment(userId)}__m-${encodeDocumentSegment(matnId)}`;
}

export function getAutomaticReviewGroupDocumentId(
  userId: string,
  passageId: string
) {
  return `u-${encodeDocumentSegment(userId)}__p-${encodeDocumentSegment(passageId)}__review-auto`;
}

export function getSafeStorageSegment(value: string) {
  return encodeDocumentSegment(value);
}
