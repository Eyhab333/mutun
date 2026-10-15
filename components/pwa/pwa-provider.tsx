"use client";

import * as React from "react";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  showIosInstallHint: boolean;
  promptInstall: () => Promise<void>;
};

const PwaInstallContext = React.createContext<PwaInstallContextValue | null>(null);

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    function updateDisplayMode() {
      setIsStandalone(isStandaloneDisplayMode());
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }

    setIsIos(isIosDevice());
    updateDisplayMode();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery.addEventListener("change", updateDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener("change", updateDisplayMode);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const value = React.useMemo<PwaInstallContextValue>(
    () => ({
      canInstall: Boolean(deferredPrompt) && !isStandalone,
      showIosInstallHint: isIos && !isStandalone && !deferredPrompt,
      promptInstall,
    }),
    [deferredPrompt, isIos, isStandalone, promptInstall]
  );

  return (
    <PwaInstallContext.Provider value={value}>
      <ServiceWorkerRegistration />
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const context = React.useContext(PwaInstallContext);

  if (!context) {
    throw new Error("usePwaInstall must be used inside PwaProvider.");
  }

  return context;
}
