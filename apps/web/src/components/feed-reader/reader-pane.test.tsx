/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import type { ArticleEmbedStatus, FeedItem, ReaderArticle } from "@/lib/types";
import { cleanup } from "@testing-library/react";

const item: FeedItem = {
  id: "item_1",
  sourceId: "source_1",
  title: "Original Story",
  url: "https://example.com/posts/original-story",
  excerpt: "Original excerpt",
  publishedAt: "2025-03-07T00:00:00.000Z",
  author: "Shivam",
  isNew: true,
  isRead: false,
};

const article: ReaderArticle = {
  itemId: item.id,
  url: item.url,
  title: item.title,
  contentHtml: "<p>Readable body copy.</p>",
  readTimeMinutes: 4,
};

const embeddable: ArticleEmbedStatus = {
  itemId: item.id,
  url: item.url,
  finalUrl: item.url,
  canEmbed: true,
};

const blocked: ArticleEmbedStatus = {
  itemId: item.id,
  url: item.url,
  finalUrl: item.url,
  canEmbed: false,
  blockedReason: "This site restricts which origins may embed it.",
};

afterEach(() => {
  cleanup();
});

const renderPane = ({
  articleEmbed = embeddable,
  articleViewMode = "site",
  isFullScreen = false,
  onArticleViewModeChange = vi.fn(),
}: {
  articleEmbed?: ArticleEmbedStatus;
  articleViewMode?: "site" | "reader";
  isFullScreen?: boolean;
  onArticleViewModeChange?: (mode: "site" | "reader") => void;
}) =>
  render(
    <ReaderPane
      item={item}
      article={article}
      articleEmbed={articleEmbed}
      articleViewMode={articleViewMode}
      isLoadingArticle={false}
      isLoadingEmbed={false}
      isFullScreen={isFullScreen}
      onClose={vi.fn()}
      onArticleViewModeChange={onArticleViewModeChange}
    />,
  );

describe("ReaderPane", () => {
  it("renders an iframe in site mode without reader chrome", () => {
    renderPane({});

    const frame = screen.getByTitle("Original article: Original Story");

    expect(frame.getAttribute("src")).toBe(item.url);
    expect(screen.queryByText("Original Story")).toBeNull();
    expect(screen.getByRole("tab", { name: "Site view" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("renders the iframe immediately while embed inspection is still loading", () => {
    render(
      <ReaderPane
        item={item}
        article={article}
        articleViewMode="site"
        isLoadingArticle={false}
        isLoadingEmbed={true}
        onClose={vi.fn()}
        onArticleViewModeChange={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Original article: Original Story").getAttribute("src")).toBe(
      item.url,
    );
  });

  it("renders a blocked fallback with actions when embedding is not allowed", () => {
    renderPane({ articleEmbed: blocked });

    expect(screen.getByText("Site preview unavailable")).toBeTruthy();
    expect(screen.getByText(blocked.blockedReason!)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use reader mode" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open original" })).toHaveLength(1);
  });

  it("switches to reader mode content from the site fallback", () => {
    let mode: "site" | "reader" = "site";
    const onArticleViewModeChange = vi.fn((nextMode: "site" | "reader") => {
      mode = nextMode;
      view.rerender(
        <ReaderPane
          item={item}
          article={article}
          articleEmbed={blocked}
          articleViewMode={mode}
          isLoadingArticle={false}
          isLoadingEmbed={false}
          onClose={vi.fn()}
          onArticleViewModeChange={onArticleViewModeChange}
        />,
      );
    });
    const view = renderPane({
      articleEmbed: blocked,
      articleViewMode: mode,
      onArticleViewModeChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Use reader mode" }));

    expect(screen.getByText("Readable body copy.")).toBeTruthy();
    expect(screen.getByText("4 min read")).toBeTruthy();
  });

  it("keeps site mode rendering in fullscreen", () => {
    renderPane({ isFullScreen: true });

    expect(screen.getByTitle("Original article: Original Story")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Site view" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});
