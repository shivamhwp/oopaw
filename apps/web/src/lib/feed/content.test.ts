import { describe, expect, it } from "vitest";
import { sanitizeFeedHtml, sanitizeFeedItems } from "@/lib/feed/content";

describe("sanitizeFeedHtml", () => {
  it("resolves reader-mode media URLs against the article URL", () => {
    const html = sanitizeFeedHtml(
      `
        <figure>
          <img src="images/hero.jpg" srcset="images/hero.jpg 1x, /cdn/hero@2x.jpg 2x">
          <picture>
            <source srcset="../media/hero.webp 1x, https://cdn.example.com/hero.avif 2x">
          </picture>
        </figure>
      `,
      "https://example.com/blog/post",
    );

    expect(html).toContain('src="https://example.com/blog/images/hero.jpg"');
    expect(html).toContain(
      'srcset="https://example.com/blog/images/hero.jpg 1x, https://example.com/cdn/hero@2x.jpg 2x"',
    );
    expect(html).toContain(
      'srcset="https://example.com/media/hero.webp 1x, https://cdn.example.com/hero.avif 2x"',
    );
  });

  it("uses each feed item's article URL as the base for HTML content", () => {
    const [item] = sanitizeFeedItems([
      {
        id: "item_1",
        sourceId: "source_1",
        url: "https://example.com/blog/post",
        title: "Post",
        contentHtml: '<p><img src="hero.jpg"></p>',
      },
    ]);

    expect(item.contentHtml).toContain('src="https://example.com/blog/hero.jpg"');
  });
});
