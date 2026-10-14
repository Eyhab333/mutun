"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function GoogleSignInButton() {
  const { loading, signingIn, signInWithGoogle } = useAuth();
  const isDisabled = loading || signingIn;

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      disabled={isDisabled}
      onClick={() => void signInWithGoogle()}
    >
      {signingIn ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <span aria-hidden className="font-sans text-base font-semibold">
          G
        </span>
      )}

      <span>
        {signingIn ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول باستخدام Google"}
      </span>
    </Button>
  );
}
