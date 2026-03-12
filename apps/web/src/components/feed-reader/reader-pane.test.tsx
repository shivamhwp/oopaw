/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import type { FeedItem } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: vi.fn(() => false),
}));

const item: FeedItem = {
  id: "item_1",
  sourceId: "source_1",
  title: "Original Story",
  url: "https://example.com/posts/original-story",
  excerpt: "Original excerpt",
  contentHtml: "<p>Readable body copy.</p>",
  publishedAt: "2025-03-07T00:00:00.000Z",
  author: "Shivam",
  isNew: true,
  isRead: false,
};

afterEach(() => {
  cleanup();
  vi.mocked(useMediaQuery).mockReturnValue(false);
});

const renderPane = ({
  articleViewMode = "site",
  isFullScreen = false,
  onArticleViewModeChange = vi.fn(),
}: {
  articleViewMode?: "site" | "reader";
  isFullScreen?: boolean;
  onArticleViewModeChange?: (mode: "site" | "reader") => void;
}) =>
  render(
    <ReaderPane
      item={item}
      articleViewMode={articleViewMode}
      isFullScreen={isFullScreen}
      onClose={vi.fn()}
      onArticleViewModeChange={onArticleViewModeChange}
    />,
  );

describe("ReaderPane", () => {
  it("renders the site iframe directly from the feed item url", () => {
    renderPane({});

    const frame = screen.getByTitle("Original article: Original Story");

    expect(frame.getAttribute("src")).toBe(item.url);
    expect(screen.getByRole("link", { name: "Open original article" }).getAttribute("href")).toBe(
      item.url,
    );
    expect(
      screen.getByText(
        "If this page does not load in the panel, open the original article in a new tab.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Site view" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("renders reader mode content when the reader tab is selected", () => {
    renderPane({
      articleViewMode: "reader",
    });

    expect(screen.getByText("Readable body copy.")).toBeTruthy();
    expect(screen.getByText("1 min read")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Reader mode" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("keeps site mode rendering in fullscreen", () => {
    renderPane({ isFullScreen: true });

    expect(screen.getByTitle("Original article: Original Story")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Site view" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("keeps back and close actions visible on mobile while hiding fullscreen toggle", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);

    render(
      <ReaderPane
        item={item}
        articleViewMode="reader"
        onBack={vi.fn()}
        onClose={vi.fn()}
        onToggleFullScreen={vi.fn()}
        onArticleViewModeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Back to list" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close reader" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
  });

  it("renders text-only feed content in reader mode", () => {
    render(
      <ReaderPane
        item={{ ...item, contentHtml: undefined, contentText: "Plain text feed body." }}
        articleViewMode="reader"
        onClose={vi.fn()}
        onArticleViewModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Plain text feed body.")).toBeTruthy();
  });

  it("shows the feed fallback when no full content is included", () => {
    render(
      <ReaderPane
        item={{ ...item, contentHtml: undefined, excerpt: "Only the summary is available." }}
        articleViewMode="reader"
        onClose={vi.fn()}
        onArticleViewModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Fallback mode")).toBeTruthy();
    expect(
      screen.getByText(
        "This feed does not include full article content. Open the original page for the complete story.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Only the summary is available.")).toBeTruthy();
  });
});
