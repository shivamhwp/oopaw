/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPwaServiceWorker } from "@/components/pwa/pwa-registration";

const registerSW = vi.fn();
const updateServiceWorker = vi.fn();

vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: Record<string, unknown>) => {
    registerSW(options);
    return updateServiceWorker;
  },
}));

describe("PWA registration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it("registers the service worker with stale-deploy recovery hooks", async () => {
    await registerPwaServiceWorker();

    expect(registerSW).toHaveBeenCalledTimes(1);

    const options = registerSW.mock.calls[0]?.[0] as {
      immediate: boolean;
      onNeedRefresh: () => void;
    };

    expect(options.immediate).toBe(true);
    expect(options.onNeedRefresh).toEqual(expect.any(Function));

    options.onNeedRefresh();

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("polls for service worker updates after registration", async () => {
    const registration = {
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const cleanup = await registerPwaServiceWorker();
    const options = registerSW.mock.calls[0]?.[0] as {
      onRegisteredSW: (swUrl: string, registration?: ServiceWorkerRegistration) => void;
    };

    options.onRegisteredSW("/sw.js", registration);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).toHaveBeenCalledWith("/sw.js", {
      cache: "no-store",
      headers: {
        cache: "no-store",
        "cache-control": "no-cache",
      },
    });
    expect(registration.update).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
