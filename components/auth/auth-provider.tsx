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

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (!isMounted) {
          return;
        }

        setUser(nextUser);
        setLoading(false);
      },
      (error) => {
        logDevelopmentError(
          "Unable to resolve Firebase authentication state.",
          error
        );

        if (isMounted) {
          setUser(null);
          setLoading(false);
          toast.error("تعذر التحقق من حالة تسجيل الدخول.");
        }
      }
    );

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

      provider.setCustomParameters({
        prompt: "select_account",
      });

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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}