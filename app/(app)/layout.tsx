import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { AuthGuard } from "@/components/auth/auth-guard";

type ProtectedAppLayoutProps = {
  children: ReactNode;
};

export default function ProtectedAppLayout({
  children,
}: ProtectedAppLayoutProps) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
