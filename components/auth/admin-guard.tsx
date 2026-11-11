"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { isAdminUser } from "@/lib/auth/admin";
import { useAuth } from "@/hooks/use-auth";

type AdminGuardProps = React.PropsWithChildren;

export function AdminGuard({ children }: AdminGuardProps) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const isAdmin = isAdminUser(user);

  React.useEffect(() => {
    if (!loading && user && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, loading, router, user]);

  if (loading || !user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
