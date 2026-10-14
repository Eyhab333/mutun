"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAuth } from "@/hooks/use-auth";

import { AuthLoadingState } from "./auth-loading-state";
import { GoogleSignInButton } from "./google-sign-in-button";

export function LoginCard() {
  const { loading, user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || user) {
    return <AuthLoadingState message="جارٍ التحقق من تسجيل الدخول..." />;
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center px-4 py-8">
      <div className="absolute top-4 end-4">
        <ThemeSwitcher />
      </div>

      <section className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">المتون</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            مساحتك لحفظ ومراجعة المتون العلمية.
          </p>
        </div>

        <div className="mt-6">
          <GoogleSignInButton />
        </div>
      </section>
    </main>
  );
}
