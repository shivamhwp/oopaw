import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFeedSourceResult,
  loadMoreFeedItemsResult,
  refreshFeedSourceResult,
} from "@/lib/server/feed";

const rssDocument = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Example Journal</title>
      <link>https://example.com/blog</link>
      <item>
        <guid>post-1</guid>
        <title>Hello Feed</title>
        <link>https://example.com/blog/hello-feed</link>
        <description>This is the first item.</description>
        <pubDate>Tue, 04 Mar 2025 10:00:00 GMT</pubDate>
      </item>
      <item>
        <guid>post-2</guid>
        <title>Newest Feed</title>
        <link>https://example.com/blog/newest-feed</link>
        <description>This is the latest item.</description>
        <pubDate>Wed, 05 Mar 2025 10:00:00 GMT</pubDate>
      </item>
    </channel>
  </rss>`;

const atomDocument = `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <title>Example Journal</title>
    <link rel="alternate" href="https://example.com/blog" />
    <link rel="self" href="https://example.com/feed.xml?page=2" />
    <link rel="next" href="https://example.com/feed.xml?page=3" />
    <entry>
      <id>post-3</id>
      <title>Older Feed</title>
      <link href="https://example.com/blog/older-feed" />
      <summary>Older entry.</summary>
      <updated>2025-03-03T10:00:00Z</updated>
    </entry>
  </feed>`;

describe("server feed functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a valid RSS feed and returns the discovery shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://example.com/feed.xml",
        text: async () => rssDocument,
        headers: new Headers({
          "content-type": "application/rss+xml",
        }),
      }),
    );

    const result = await fetchFeedSourceResult({
      url: "https://example.com/feed.xml",
    });

    expect(result).toMatchObject({
      source: {
        label: "Example Journal",
        inputUrl: "https://example.com/feed.xml",
        siteUrl: "https://example.com/blog",
        feedUrl: "https://example.com/feed.xml",
        pollingEnabled: true,
      },
      nextPageUrl: undefined,
    });
    expect(result.items).toHaveLength(2);
  });

  it("rejects homepage and JSON feed inputs with the strict feed-only message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        url: "https://example.com",
        text: async () => "<html><body>Homepage</body></html>",
        headers: new Headers({
          "content-type": "text/html",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        url: "https://example.com/feed.json",
        text: async () => JSON.stringify({ version: "https://jsonfeed.org/version/1.1" }),
        headers: new Headers({
          "content-type": "application/feed+json",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchFeedSourceResult({
        url: "https://example.com",
      }),
    ).rejects.toThrow(
      "Paste a direct RSS or Atom feed URL. Homepages and JSON feeds are not supported.",
    );
    await expect(
      fetchFeedSourceResult({
        url: "https://example.com/feed.json",
      }),
    ).rejects.toThrow(
      "Paste a direct RSS or Atom feed URL. Homepages and JSON feeds are not supported.",
    );
  });

  it("refreshes a feed via the server function result shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://example.com/feed.xml",
        text: async () => rssDocument,
        headers: new Headers({
          "content-type": "application/rss+xml",
        }),
      }),
    );

    const result = await refreshFeedSourceResult({
      source: {
        id: "source_alpha",
        feedUrl: "https://example.com/feed.xml",
      },
      seenItemIds: ["source_alpha:post-1"],
    });

    expect(result.sourceId).toBe("source_alpha");
    expect(result.items).toHaveLength(2);
    expect(result.newCount).toBeGreaterThanOrEqual(1);
  });

  it("loads more feed items via the server function result shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://example.com/feed.xml?page=2",
        text: async () => atomDocument,
        headers: new Headers({
          "content-type": "application/atom+xml",
        }),
      }),
    );

    const result = await loadMoreFeedItemsResult({
      source: {
        id: "source_alpha",
      },
      pageUrl: "https://example.com/feed.xml?page=2",
    });

    expect(result).toMatchObject({
      sourceId: "source_alpha",
      pageUrl: "https://example.com/feed.xml?page=2",
      nextPageUrl: "https://example.com/feed.xml?page=3",
    });
    expect(result.items).toHaveLength(1);
  });
});
