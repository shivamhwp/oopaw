import { describe, expect, it } from "vitest";
import {
  getInitialVisibleCount,
  getNextVisibleCount,
  getRemoteLoadTriggerKey,
} from "@/components/feed-reader/use-progressive-window";

describe("useProgressiveWindow helpers", () => {
  it("starts item lists at 30 visible entries and reveals 30 more near the end", () => {
    expect(getInitialVisibleCount(90, 30)).toBe(30);
    expect(
      getNextVisibleCount({
        loadedCount: 90,
        pageSize: 30,
        threshold: 6,
        visibleCount: 30,
        lastVisibleIndex: 24,
      }),
    ).toBe(60);
  });

  it("starts grid views at 20 visible cards and reveals 20 more near the end", () => {
    expect(getInitialVisibleCount(50, 20)).toBe(20);
    expect(
      getNextVisibleCount({
        loadedCount: 50,
        pageSize: 20,
        threshold: 4,
        visibleCount: 20,
        lastVisibleIndex: 16,
      }),
    ).toBe(40);
  });

  it("triggers remote loading once per loaded page and only for new trigger keys", () => {
    expect(
      getRemoteLoadTriggerKey({
        identityKey: "source_alpha",
        loadedCount: 30,
        threshold: 6,
        lastVisibleIndex: 24,
        hasRemoteMore: true,
        isFetchingRemoteMore: false,
        hasRemoteLoadHandler: true,
        lastRemoteTriggerKey: null,
      }),
    ).toBe("source_alpha:30");

    expect(
      getRemoteLoadTriggerKey({
        identityKey: "source_alpha",
        loadedCount: 30,
        threshold: 6,
        lastVisibleIndex: 29,
        hasRemoteMore: true,
        isFetchingRemoteMore: false,
        hasRemoteLoadHandler: true,
        lastRemoteTriggerKey: "source_alpha:30",
      }),
    ).toBeNull();

    expect(
      getRemoteLoadTriggerKey({
        identityKey: "source_alpha",
        loadedCount: 30,
        threshold: 6,
        lastVisibleIndex: 24,
        hasRemoteMore: true,
        isFetchingRemoteMore: true,
        hasRemoteLoadHandler: true,
        lastRemoteTriggerKey: null,
      }),
    ).toBeNull();
  });
});
