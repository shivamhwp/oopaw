/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleDeploymentError, recoverFromStaleDeployment } from "@/lib/deployment-recovery";

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
});
