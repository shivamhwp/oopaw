import { describe, expect, it } from "vitest";
import {
  shouldFetchReaderArticle,
  shouldInspectArticleEmbed,
} from "@/components/feed-reader/use-feed-reader";
import type { FeedItem } from "@/lib/types";

const item: FeedItem = {
  id: "item_1",
  sourceId: "source_1",
  title: "Original Story",
  url: "https://example.com/posts/original-story",
  publishedAt: "2025-03-07T00:00:00.000Z",
  isNew: true,
  isRead: false,
};

describe("useFeedReader query gating", () => {
  it("does not fetch reader content while site mode is active", () => {
    expect(shouldFetchReaderArticle(item, "site")).toBe(false);
    expect(shouldInspectArticleEmbed(item)).toBe(true);
  });

  it("enables reader content only in reader mode and still warms embed state", () => {
    expect(shouldFetchReaderArticle(item, "reader")).toBe(true);
    expect(shouldInspectArticleEmbed(item)).toBe(true);
  });

  it("disables both article queries when no item is selected", () => {
    expect(shouldFetchReaderArticle(undefined, "reader")).toBe(false);
    expect(shouldInspectArticleEmbed(undefined)).toBe(false);
  });
});
