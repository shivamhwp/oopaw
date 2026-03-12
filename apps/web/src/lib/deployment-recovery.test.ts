/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupLocalhostCachesOncePerSession,
  isLocalDevelopmentHostname,
  isStaleDeploymentError,
  recoverFromStaleDeployment,
} from "@/lib/deployment-recovery";

describe("deployment recovery", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("detects stale deployment failures from chunk and server function errors", () => {
    expect(
      isStaleDeploymentError(
        new Error("A bad HTTP response code (404) was received when fetching the script."),
      ),
    ).toBe(true);
    expect(isStaleDeploymentError(new Error("Server function info not found for dd28c81"))).toBe(
      true,
    );
    expect(isStaleDeploymentError(new Error("Request failed with status 500."))).toBe(false);
  });

  it("reloads the page once per tab session for stale deployment errors", () => {
    const reload = vi.fn();

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload,
      },
    });

    expect(
      recoverFromStaleDeployment(
        new Error("A bad HTTP response code (404) was received when fetching the script."),
      ),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(
      recoverFromStaleDeployment(
        new Error("A bad HTTP response code (404) was received when fetching the script."),
      ),
    ).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("cleans service workers and caches once per session on localhost only", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    const deleteCache = vi.fn().mockResolvedValue(true);
    const keys = vi.fn().mockResolvedValue(["workbox-precache-v1"]);

    await expect(
      cleanupLocalhostCachesOncePerSession({
        hostname: "localhost",
        sessionStorage: window.sessionStorage,
        serviceWorker: { getRegistrations },
        cacheStorage: { keys, delete: deleteCache },
      }),
    ).resolves.toBe(true);
    await expect(
      cleanupLocalhostCachesOncePerSession({
        hostname: "localhost",
        sessionStorage: window.sessionStorage,
        serviceWorker: { getRegistrations },
        cacheStorage: { keys, delete: deleteCache },
      }),
    ).resolves.toBe(false);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("workbox-precache-v1");
  });

  it("skips localhost cache cleanup for non-local origins", async () => {
    const getRegistrations = vi.fn();
    const deleteCache = vi.fn();

    await expect(
      cleanupLocalhostCachesOncePerSession({
        hostname: "example.com",
        sessionStorage: window.sessionStorage,
        serviceWorker: { getRegistrations },
        cacheStorage: { keys: vi.fn(), delete: deleteCache },
      }),
    ).resolves.toBe(false);
    expect(isLocalDevelopmentHostname("example.com")).toBe(false);
    expect(isLocalDevelopmentHostname("localhost")).toBe(true);
    expect(getRegistrations).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
  });
});
