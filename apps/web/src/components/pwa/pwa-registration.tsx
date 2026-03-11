import { useEffect } from "react";

export const registerPwaServiceWorker = async () => {
  const { registerSW } = await import("virtual:pwa-register");

  return registerSW({
    immediate: true,
  });
};

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    void registerPwaServiceWorker();
  }, []);

  return null;
}
