/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { registerPwaServiceWorker } from "@/components/pwa/pwa-registration";

const registerSW = vi.fn();

vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: { immediate: boolean }) => {
    registerSW(options);
    return vi.fn();
  },
}));

describe("PWA registration", () => {
  it("registers the service worker without any custom UI flow", async () => {
    await registerPwaServiceWorker();

    expect(registerSW).toHaveBeenCalledWith({ immediate: true });
  });
});
