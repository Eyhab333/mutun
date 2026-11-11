import type { User } from "firebase/auth";

export const ADMIN_UID = "ptQwoqUEzygvsm4BpfdvGruJnvj1";

export function isAdminUser(
  user: Pick<User, "uid"> | null | undefined
) {
  return user?.uid === ADMIN_UID;
}
