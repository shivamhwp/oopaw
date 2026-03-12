import { describe, expect, it } from "vitest";
import { getOneDollarStatsScriptConfig } from "./onedollarstats";

describe("getOneDollarStatsScriptConfig", () => {
  it("returns null without a site id", () => {
    const result = getOneDollarStatsScriptConfig({
      DEV: false,
      VITE_ONEDOLLARSTATS_ENABLED: undefined,
      VITE_ONEDOLLARSTATS_SCRIPT_SRC: undefined,
      VITE_ONEDOLLARSTATS_SITE_ID: undefined,
    });

    expect(result).toBeNull();
  });

  it("returns null in development unless explicitly enabled", () => {
    const result = getOneDollarStatsScriptConfig({
      DEV: true,
      VITE_ONEDOLLARSTATS_ENABLED: undefined,
      VITE_ONEDOLLARSTATS_SCRIPT_SRC: undefined,
      VITE_ONEDOLLARSTATS_SITE_ID: "site_123",
    });

    expect(result).toBeNull();
  });

  it("returns config in production with default script source", () => {
    const result = getOneDollarStatsScriptConfig({
      DEV: false,
      VITE_ONEDOLLARSTATS_ENABLED: undefined,
      VITE_ONEDOLLARSTATS_SCRIPT_SRC: undefined,
      VITE_ONEDOLLARSTATS_SITE_ID: "site_123",
    });

    expect(result).toEqual({
      siteId: "site_123",
      scriptSrc: "https://onedollarstats.com/tracker.js",
    });
  });

  it("allows explicit enablement during development", () => {
    const result = getOneDollarStatsScriptConfig({
      DEV: true,
      VITE_ONEDOLLARSTATS_ENABLED: "true",
      VITE_ONEDOLLARSTATS_SCRIPT_SRC: "https://cdn.example.com/ods.js",
      VITE_ONEDOLLARSTATS_SITE_ID: "dev_site",
    });

    expect(result).toEqual({
      siteId: "dev_site",
      scriptSrc: "https://cdn.example.com/ods.js",
    });
  });

  it("respects explicit disablement", () => {
    const result = getOneDollarStatsScriptConfig({
      DEV: false,
      VITE_ONEDOLLARSTATS_ENABLED: "false",
      VITE_ONEDOLLARSTATS_SCRIPT_SRC: undefined,
      VITE_ONEDOLLARSTATS_SITE_ID: "site_123",
    });

    expect(result).toBeNull();
  });
});
