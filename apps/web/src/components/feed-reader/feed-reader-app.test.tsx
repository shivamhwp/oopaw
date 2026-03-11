/** @vitest-environment jsdom */

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FeedReaderBootScreen,
  shouldShowFeedReaderBootScreen,
} from "@/components/feed-reader/feed-reader-app";

describe("feed reader boot screen", () => {
  it("renders the loading spinner markup without the empty-state copy", () => {
    const markup = renderToString(<FeedReaderBootScreen />);

    expect(markup).toContain("Loading feeds");
    expect(markup).not.toContain("No feeds yet");
  });

  it("shows the boot screen only until the client is ready", () => {
    expect(shouldShowFeedReaderBootScreen(false)).toBe(true);
    expect(shouldShowFeedReaderBootScreen(true)).toBe(false);
  });
});
