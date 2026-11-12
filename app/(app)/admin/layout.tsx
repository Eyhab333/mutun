import type { ReactNode } from "react";

import { AdminGuard } from "@/components/auth/admin-guard";

// Admin content waits for the client-side Firebase authorization check.
export const instant = false;

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminGuard>{children}</AdminGuard>;
}
