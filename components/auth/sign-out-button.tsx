"use client";

import * as React from "react";
import { LogOut, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
  labelClassName?: string;
};

export function SignOutButton({
  className,
  labelClassName,
}: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const { signOutUser } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOutUser();
      router.replace("/login");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Google sign-out failed.", error);
      }

      toast.error("تعذر تسجيل الخروج. يرجى المحاولة مرة أخرى.");
      setIsSigningOut(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("w-full justify-start", className)}
      disabled={isSigningOut}
      aria-label="تسجيل الخروج"
      onClick={() => void handleSignOut()}
    >
      {isSigningOut ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      <span className={labelClassName}>تسجيل الخروج</span>
    </Button>
  );
}
