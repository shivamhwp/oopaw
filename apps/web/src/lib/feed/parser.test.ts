import { describe, expect, it } from "vitest";
import { looksLikeFeedDocument, parseFeedDocument } from "@/lib/feed/parser";

describe("parseFeedDocument", () => {
  it("parses RSS feeds into normalized items", () => {
    const document = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>Example Journal</title>
          <link>https://example.com/blog</link>
          <item>
            <guid>post-1</guid>
            <title>Hello Feed</title>
            <link>https://example.com/blog/hello-feed</link>
            <description><![CDATA[This is the first item.]]></description>
            <content:encoded><![CDATA[<p>Hello <strong>world</strong>.</p>]]></content:encoded>
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
      contentHtml: "<p>Hello <strong>world</strong>.</p>",
      excerpt: "This is the first item.",
    });
  });

  it("parses Atom content as text and keeps next-page links", () => {
    const document = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Stream</title>
        <link rel="alternate" href="https://example.com/blog" />
        <link rel="next" href="/feed?page=2" />
        <entry>
          <id>tag:example.com,2025:alpha</id>
          <title>Alpha</title>
          <link href="https://example.com/blog/alpha" />
          <summary>Short summary</summary>
          <content type="text">Full atom text body.</content>
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
    expect(parsed.items[0]).toMatchObject({
      title: "Alpha",
      url: "https://example.com/blog/alpha",
      contentText: "Full atom text body.",
      excerpt: "Short summary",
    });
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

  it("derives an excerpt from full content when summary fields are absent", () => {
    const document = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Stream</title>
        <link rel="alternate" href="https://example.com/blog" />
        <entry>
          <id>tag:example.com,2025:alpha</id>
          <title>Alpha</title>
          <link href="https://example.com/blog/alpha" />
          <content type="html"><![CDATA[<p>Full body without a summary.</p>]]></content>
          <updated>2025-03-08T11:00:00.000Z</updated>
        </entry>
      </feed>`;

    const parsed = parseFeedDocument({
      body: document,
      baseUrl: "https://example.com/feed.xml",
      sourceId: "source_atom",
    });

    expect(parsed.items[0]).toMatchObject({
      contentHtml: "<p>Full body without a summary.</p>",
      excerpt: "Full body without a summary.",
    });
  });

  it("rejects non-RSS formats and JSON feeds", () => {
    expect(
      looksLikeFeedDocument(
        "application/feed+json",
        '{"version":"https://jsonfeed.org/version/1.1"}',
      ),
    ).toBe(false);

    expect(() =>
      parseFeedDocument({
        body: "<html><body>Homepage</body></html>",
        baseUrl: "https://example.com",
        sourceId: "source_html",
      }),
    ).toThrow("Paste a direct RSS or Atom feed URL. Homepages and JSON feeds are not supported.");
  });
});
