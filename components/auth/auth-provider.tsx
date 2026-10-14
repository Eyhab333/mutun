"use client";

import * as React from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { toast } from "sonner";

import { auth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

export const AuthContext = React.createContext<AuthContextValue | null>(null);

const allowedEmail = normalizeEmail(process.env.NEXT_PUBLIC_ALLOWED_EMAIL);

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function isAllowedUser(user: User) {
  if (!allowedEmail) {
    return process.env.NODE_ENV === "development";
  }

  return normalizeEmail(user.email) === allowedEmail;
}

function getSignInErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  switch (code) {
    case "auth/popup-closed-by-user":
      return "أُغلقت نافذة تسجيل الدخول قبل إتمام العملية.";
    case "auth/popup-blocked":
      return "تعذر فتح نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة.";
    case "auth/network-request-failed":
      return "تعذر الاتصال بالشبكة. يرجى المحاولة مرة أخرى.";
    default:
      return "تعذر تسجيل الدخول باستخدام Google. يرجى المحاولة مرة أخرى.";
  }
}

function logDevelopmentError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(message, error);
  }
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signingIn, setSigningIn] = React.useState(false);
  const signingInRef = React.useRef(false);

  React.useEffect(() => {
    let isMounted = true;
    let isSigningOutUnauthorizedUser = false;

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        void resolveAuthState(nextUser);
      },
      (error) => {
        logDevelopmentError("Unable to resolve Firebase authentication state.", error);

        if (isMounted) {
          setUser(null);
          setLoading(false);
          toast.error("تعذر التحقق من حالة تسجيل الدخول.");
        }
      }
    );

    async function resolveAuthState(nextUser: User | null) {
      if (!isMounted) {
        return;
      }

      if (nextUser && !isAllowedUser(nextUser)) {
        if (isSigningOutUnauthorizedUser) {
          return;
        }

        isSigningOutUnauthorizedUser = true;

        try {
          await signOut(auth);
        } catch (error) {
          logDevelopmentError("Unable to sign out an unauthorized user.", error);
        } finally {
          if (isMounted) {
            setUser(null);
            setLoading(false);
            toast.error("هذا الحساب غير مصرح له بالدخول إلى التطبيق.");
          }
        }

        return;
      }

      isSigningOutUnauthorizedUser = false;
      setUser(nextUser);
      setLoading(false);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    if (signingInRef.current) {
      return;
    }

    signingInRef.current = true;
    setSigningIn(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      logDevelopmentError("Google sign-in failed.", error);
      toast.error(getSignInErrorMessage(error));
    } finally {
      signingInRef.current = false;
      setSigningIn(false);
    }
  }, []);

  const signOutUser = React.useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signingIn,
      signInWithGoogle,
      signOutUser,
    }),
    [loading, signInWithGoogle, signOutUser, signingIn, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
