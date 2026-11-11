import type { ReactNode } from "react";

import { AdminGuard } from "@/components/auth/admin-guard";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminGuard>{children}</AdminGuard>;
}
