import { describe, expect, it } from "vitest";
import {
  discoverFeedLinksFromHtml,
  extractArticleFromHtml,
  scrapeLatestFromHtml,
} from "@/lib/feed/discovery";

describe("feed discovery helpers", () => {
  it("discovers alternate feed links from site html", () => {
    const result = discoverFeedLinksFromHtml(
      `<!doctype html>
      <html>
        <head>
          <title>Shivam Notes</title>
          <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Main feed" />
        </head>
      </html>`,
      "https://shivam.ing/blogs",
    );

    expect(result.siteTitle).toBe("Shivam Notes");
    expect(result.feedLinks[0]?.url).toBe("https://shivam.ing/feed.xml");
  });

  it("scrapes article links when no feed is present", () => {
    const result = scrapeLatestFromHtml({
      html: `<!doctype html>
        <main>
          <article>
            <h2><a href="/posts/first-post">First Post</a></h2>
            <p>One short excerpt.</p>
            <time datetime="2025-03-07T00:00:00.000Z"></time>
          </article>
        </main>`,
      baseUrl: "https://example.com/blog",
      sourceId: "source_scrape",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "First Post",
      url: "https://example.com/posts/first-post",
    });
  });

  it("extracts sanitized reader content from article html", () => {
    const result = extractArticleFromHtml({
      html: `<!doctype html>
        <html>
          <head>
            <title>Readable Story</title>
            <meta name="description" content="Readable summary" />
          </head>
          <body>
            <article>
              <h1>Readable Story</h1>
              <p>This is a proper article body with enough text for extraction.</p>
              <script>alert("xss")</script>
            </article>
          </body>
        </html>`,
      url: "https://example.com/readable-story",
      itemId: "item_1",
    });

    expect(result.title).toBe("Readable Story");
    expect(result.contentHtml).toContain("proper article body");
    expect(result.contentHtml).not.toContain("script");
    expect(result.excerpt).toBe("Readable summary");
  });
});
