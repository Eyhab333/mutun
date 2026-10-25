"use client";

import * as React from "react";
import { toast } from "sonner";

const UPDATE_TOAST_ID = "mutun-pwa-update";

export async function registerMutunServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  return registration.active ? registration : navigator.serviceWorker.ready;
}

export function ServiceWorkerRegistration() {
  const shouldReloadRef = React.useRef(false);
  const updateShownRef = React.useRef(false);

  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
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

        promptForUpdate();

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
        if (process.env.NODE_ENV === "development") {
          console.error("Service worker registration failed.", error);
        }
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
