"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";

import { AuthLoadingState } from "./auth-loading-state";

type AuthGuardProps = React.PropsWithChildren;

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const isAccessPending = loading || !user;

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  return (
    <>
      <div
        aria-hidden={isAccessPending || undefined}
        className={isAccessPending ? "hidden" : undefined}
      >
        {children}
      </div>

      {isAccessPending ? (
        <div className="fixed inset-0 z-50 bg-background">
          <AuthLoadingState
            message={
              loading
                ? undefined
                : "جارٍ تحويلك إلى تسجيل الدخول..."
            }
          />
        </div>
      ) : null}
    </>
  );
}
