/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  getThemeInitScript,
} from "@/components/theme-provider";

const createMockStorage = (initialTheme: string | null) => ({
  getItem: vi.fn((key: string) => (key === THEME_STORAGE_KEY ? initialTheme : null)),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

describe("theme bootstrapping", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
  });

  it("applies a persisted dark theme before hydration", () => {
    vi.stubGlobal("localStorage", createMockStorage("dark"));
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    );

    new Function(getThemeInitScript())();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("falls back to the system theme when no persisted theme exists", () => {
    vi.stubGlobal("localStorage", createMockStorage(null));
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    );

    new Function(getThemeInitScript(THEME_STORAGE_KEY, DEFAULT_THEME))();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("keeps the root color scheme in sync when applying the runtime theme", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
      }),
    );

    applyTheme("light");

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
