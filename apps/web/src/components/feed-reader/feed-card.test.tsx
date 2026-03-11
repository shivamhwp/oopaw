/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedCard } from "@/components/feed-reader/feed-card";
import type { FeedItem, SavedSource } from "@/lib/types";

const source: SavedSource = {
  id: "source_1",
  label: "Example Feed",
  inputUrl: "https://example.com",
  siteUrl: "https://example.com",
  feedUrl: "https://example.com/feed.xml",
  kind: "feed",
  pollingEnabled: true,
  pollIntervalMs: 300000,
};

const items: FeedItem[] = [
  {
    id: "item_1",
    sourceId: source.id,
    url: "https://example.com/posts/1",
    title: "First story",
    excerpt: "Excerpt",
    publishedAt: "2025-03-07T00:00:00.000Z",
    author: "Shivam",
    isNew: true,
    isRead: false,
  },
];

describe("FeedCard", () => {
  it("keeps the remove action accessible with the source name", () => {
    render(
      <FeedCard
        source={source}
        items={items}
        unreadCount={1}
        newCount={1}
        isSelected={false}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Remove feed Example Feed" })).toBeTruthy();
  });
});
