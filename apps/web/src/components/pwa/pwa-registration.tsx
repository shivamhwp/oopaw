import { useEffect } from "react";
import {
  installStaleDeploymentRecovery,
  isStaleDeploymentError,
  recoverFromStaleDeployment,
} from "@/lib/deployment-recovery";

const SERVICE_WORKER_UPDATE_INTERVAL_MS = 60_000;

const registerPeriodicSwUpdates = (
  swUrl: string,
  registration: ServiceWorkerRegistration | undefined,
) => {
  if (!registration || typeof window === "undefined") {
    return () => {};
  }

  const intervalId = window.setInterval(async () => {
    if (registration.installing || !navigator.onLine) {
      return;
    }

    try {
      const response = await fetch(swUrl, {
        cache: "no-store",
        headers: {
          cache: "no-store",
          "cache-control": "no-cache",
        },
      });

      if (response.status === 200) {
        await registration.update();
      }
    } catch (error) {
      if (!isStaleDeploymentError(error)) {
        console.error("Service worker update check failed.", error);
      }
    }
  }, SERVICE_WORKER_UPDATE_INTERVAL_MS);

  return () => {
    window.clearInterval(intervalId);
  };
};

export const registerPwaServiceWorker = async () => {
  const { registerSW } = await import("virtual:pwa-register");
  let stopPeriodicSwUpdates = () => {};
  let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateServiceWorker?.(true);
    },
    onRegisteredSW(swUrl, registration) {
      stopPeriodicSwUpdates();
      stopPeriodicSwUpdates = registerPeriodicSwUpdates(swUrl, registration);
    },
    onRegisterError(error) {
      if (!recoverFromStaleDeployment(error)) {
        console.error("Service worker registration failed.", error);
      }
    },
  });

  return () => {
    stopPeriodicSwUpdates();
  };
};

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const cleanupStaleDeploymentRecovery = installStaleDeploymentRecovery();
    let cleanupPwaRegistration = () => {};

    void registerPwaServiceWorker().then((cleanup) => {
      cleanupPwaRegistration = cleanup;
    });

    return () => {
      cleanupPwaRegistration();
      cleanupStaleDeploymentRecovery();
    };
  }, []);

  return null;
}
