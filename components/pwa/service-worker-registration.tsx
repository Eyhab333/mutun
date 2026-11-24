"use client";

import * as React from "react";
import { toast } from "sonner";

const UPDATE_TOAST_ID = "mutun-pwa-update";

let developmentCleanupPromise: Promise<boolean> | null = null;

export function isMutunServiceWorkerEnabled() {
  return process.env.NODE_ENV === "production";
}

export function cleanupMutunDevelopmentPwaArtifacts(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (developmentCleanupPromise) {
    return developmentCleanupPromise;
  }

  developmentCleanupPromise = (async () => {
    let hadActiveWorker = false;
    const cleanupTasks: Promise<unknown>[] = [];

    if ("serviceWorker" in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          if (registrations.length > 0) {
            hadActiveWorker = true;
          }
          return Promise.all(
            registrations.map((registration) => registration.unregister())
          );
        })
      );
    }

    if ("caches" in window) {
      cleanupTasks.push(
        window.caches.keys().then((keys) =>
          Promise.all(keys.map((key) => window.caches.delete(key)))
        )
      );
    }

    await Promise.all(cleanupTasks);
    return hadActiveWorker;
  })();

  return developmentCleanupPromise;
}

export async function registerMutunServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  if (!isMutunServiceWorkerEnabled()) {
    await cleanupMutunDevelopmentPwaArtifacts();
    throw new Error("Service workers are disabled during development.");
  }

  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export function ServiceWorkerRegistration() {
  const shouldReloadRef = React.useRef(false);
  const updateShownRef = React.useRef(false);

  React.useEffect(() => {
    if (!isMutunServiceWorkerEnabled()) {
      void cleanupMutunDevelopmentPwaArtifacts()
        .then((hadActiveWorker) => {
          // إذا كان هناك Service Worker قديم عالق من جلسة سابقة، أعد التحميل مرة واحدة لتحرير الصفحة
          if (hadActiveWorker && !sessionStorage.getItem("pwa-dev-cleaned")) {
            sessionStorage.setItem("pwa-dev-cleaned", "true");
            window.location.reload();
          }
        })
        .catch((error) => {
          console.error("Unable to clear development PWA artifacts.", error);
        });

      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    function promptForUpdate() {
      if (
        cancelled ||
        updateShownRef.current ||
        !registration?.waiting ||
        !navigator.serviceWorker.controller
      ) {
        return;
      }

      updateShownRef.current = true;

      toast.info("يتوفر تحديث جديد للتطبيق", {
        id: UPDATE_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "تحديث",
          onClick: () => {
            if (!registration?.waiting) {
              return;
            }

            shouldReloadRef.current = true;
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    }

    function handleControllerChange() {
      if (shouldReloadRef.current) {
        window.location.reload();
      }
    }

    async function registerServiceWorker() {
      if (cancelled) {
        return;
      }

      try {
        registration = await registerMutunServiceWorker();

        if (cancelled) {
          return;
        }

        // فحص التحديثات المعلقة فوراً
        promptForUpdate();

        // الاستماع لأي تحديث جديد يبدأ التثبيت
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration?.installing;

          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed") {
              promptForUpdate();
            }
          });
        });
      } catch (error) {
        console.error("Service worker registration failed.", error);
      }
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const handleLoad = () => {
      void registerServiceWorker();
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", handleLoad);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  return null;
}
