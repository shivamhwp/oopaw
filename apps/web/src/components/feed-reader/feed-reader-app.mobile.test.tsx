/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
  getFeedReaderLayoutMode,
  shouldShowFeedReaderBootScreen,
} from "@/components/feed-reader/feed-reader-app";

describe("FeedReaderApp layout helpers", () => {
  it("switches to the mobile shell for narrow screens", () => {
    expect(getFeedReaderLayoutMode(true)).toBe("mobile");
    expect(getFeedReaderLayoutMode(false)).toBe("desktop");
  });

  it("still blocks the shell until the client is ready", () => {
    expect(shouldShowFeedReaderBootScreen(false)).toBe(true);
    expect(shouldShowFeedReaderBootScreen(true)).toBe(false);
  });
});
