import { describe, expect, it } from "vitest";
import { getOneDollarStatsConfig } from "./onedollarstats";

describe("getOneDollarStatsConfig", () => {
  it("returns config by default in production", () => {
    const result = getOneDollarStatsConfig({
      DEV: false,
      VITE_ONEDOLLARSTATS_COLLECTOR_URL: undefined,
      VITE_ONEDOLLARSTATS_ENABLED: undefined,
      VITE_ONEDOLLARSTATS_HOSTNAME: undefined,
    });

    expect(result).toEqual({
      autocollect: true,
      hashRouting: false,
    });
  });

  it("returns null when explicitly disabled", () => {
    const result = getOneDollarStatsConfig({
      DEV: false,
      VITE_ONEDOLLARSTATS_COLLECTOR_URL: undefined,
      VITE_ONEDOLLARSTATS_ENABLED: "false",
      VITE_ONEDOLLARSTATS_HOSTNAME: undefined,
    });

    expect(result).toBeNull();
  });

  it("returns null in development without explicit enablement", () => {
    const result = getOneDollarStatsConfig({
      DEV: true,
      VITE_ONEDOLLARSTATS_COLLECTOR_URL: undefined,
      VITE_ONEDOLLARSTATS_ENABLED: undefined,
      VITE_ONEDOLLARSTATS_HOSTNAME: "example.com",
    });

    expect(result).toBeNull();
  });

  it("returns null in development without a hostname", () => {
    const result = getOneDollarStatsConfig({
      DEV: true,
      VITE_ONEDOLLARSTATS_COLLECTOR_URL: undefined,
      VITE_ONEDOLLARSTATS_ENABLED: "true",
      VITE_ONEDOLLARSTATS_HOSTNAME: undefined,
    });

    expect(result).toBeNull();
  });

  it("returns devmode config when explicitly enabled with a hostname", () => {
    const result = getOneDollarStatsConfig({
      DEV: true,
      VITE_ONEDOLLARSTATS_COLLECTOR_URL: "https://collector.example.com/events",
      VITE_ONEDOLLARSTATS_ENABLED: "true",
      VITE_ONEDOLLARSTATS_HOSTNAME: "app.example.com",
    });

    expect(result).toEqual({
      autocollect: true,
      collectorUrl: "https://collector.example.com/events",
      devmode: true,
      hashRouting: false,
      hostname: "app.example.com",
    });
  });
});
