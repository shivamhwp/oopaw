import { describe, expect, it } from "vitest";
import { parseFeedDocument } from "@/lib/feed/parser";

describe("parseFeedDocument", () => {
  it("parses RSS feeds into normalized items", () => {
    const document = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Example Journal</title>
          <link>https://example.com/blog</link>
          <item>
            <guid>post-1</guid>
            <title>Hello Feed</title>
            <link>https://example.com/blog/hello-feed</link>
            <description><![CDATA[This is the first item.]]></description>
            <pubDate>Tue, 04 Mar 2025 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    const parsed = parseFeedDocument({
      body: document,
      baseUrl: "https://example.com/feed.xml",
      sourceId: "source_1",
    });

    expect(parsed.label).toBe("Example Journal");
    expect(parsed.siteUrl).toBe("https://example.com/blog");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      sourceId: "source_1",
      title: "Hello Feed",
      url: "https://example.com/blog/hello-feed",
    });
  });

  it("parses JSON feeds into normalized items", () => {
    const document = JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      title: "JSON Letters",
      home_page_url: "https://letters.example.com",
      feed_url: "https://letters.example.com/feed.json",
      next_url: "https://letters.example.com/feed/page/2.json",
      items: [
        {
          id: "alpha",
          url: "https://letters.example.com/posts/alpha",
          title: "Alpha",
          summary: "A short summary",
          date_published: "2025-03-07T11:00:00.000Z",
        },
      ],
    });

    const parsed = parseFeedDocument({
      body: document,
      baseUrl: "https://letters.example.com/feed.json",
      sourceId: "source_json",
    });

    expect(parsed.label).toBe("JSON Letters");
    expect(parsed.items[0]?.excerpt).toBe("A short summary");
    expect(parsed.nextPageUrl).toBe("https://letters.example.com/feed/page/2.json");
  });

  it("parses Atom rel=next pagination links", () => {
    const document = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Stream</title>
        <link rel="alternate" href="https://example.com/blog" />
        <link rel="next" href="/feed?page=2" />
        <entry>
          <id>tag:example.com,2025:alpha</id>
          <title>Alpha</title>
          <link href="https://example.com/blog/alpha" />
          <updated>2025-03-08T11:00:00.000Z</updated>
        </entry>
      </feed>`;

    const parsed = parseFeedDocument({
      body: document,
      baseUrl: "https://example.com/feed.xml",
      sourceId: "source_atom",
    });

    expect(parsed.siteUrl).toBe("https://example.com/blog");
    expect(parsed.nextPageUrl).toBe("https://example.com/feed?page=2");
  });

  it("leaves rss feeds without a next page cursor", () => {
    const document = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Example Journal</title>
          <link>https://example.com/blog</link>
          <item>
            <guid>post-1</guid>
            <title>Hello Feed</title>
            <link>https://example.com/blog/hello-feed</link>
          </item>
        </channel>
      </rss>`;

    const parsed = parseFeedDocument({
      body: document,
      baseUrl: "https://example.com/feed.xml",
      sourceId: "source_1",
    });

    expect(parsed.nextPageUrl).toBeUndefined();
  });
});
