import { createServerFn } from "@tanstack/react-start";
import { Readability } from "@mozilla/readability";
import { Result, TaggedError } from "better-result";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { sanitizeReaderHtml } from "@/lib/feed/content";
import { unwrapOrThrow } from "@/lib/result";
import { createExcerpt, normalizeOptionalDate, resolveUrl, stripHtml } from "@/lib/feed/utils";
import { extractReaderArticleInputSchema, extractedReaderArticleSchema } from "@/lib/types";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MIN_FEED_HTML_LENGTH = 320;
const MIN_FEED_TEXT_LENGTH = 700;
const MIN_READABILITY_LENGTH = 80;
const MAX_LINK_DENSITY = 0.45;

const FETCH_HEADERS: HeadersInit = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (compatible; PapertrailBot/1.0; +https://papertrail.app) AppleWebKit/537.36",
};

const NAV_SELECTOR = [
  "nav",
  "[role='navigation']",
  "[role='menu']",
  "[aria-label*='breadcrumb' i]",
  "[class*='breadcrumb' i]",
  "[id*='breadcrumb' i]",
].join(",");

const CLUTTER_SELECTOR = [
  "[class*='share' i]",
  "[class*='social' i]",
  "[id*='share' i]",
  "[class*='related-post' i]",
  "[class*='recommended' i]",
  "[class*='read-next' i]",
  "[class*='read-more' i]",
  "[id*='comment' i]",
  "[class*='comment-section' i]",
  "[id*='disqus' i]",
  "[class*='newsletter' i]",
  "[class*='subscribe' i]",
  "[class*='signup' i]",
  "[class*='advert' i]",
  "[class*='ad-slot' i]",
  "[id*='ad-' i]",
  "ins.adsbygoogle",
].join(",");

const REMOVABLE_CONTAINERS = new Set(["DIV", "SECTION", "ASIDE", "FOOTER", "FORM", "NAV"]);

const MEDIA_SELECTOR = "img, picture, source, video, iframe";

const LAZY_SRC_ATTRS = [
  "src",
  "data-src",
  "data-lazy-src",
  "data-original",
  "data-url",
  "data-orig-file",
  "data-large-file",
] as const;

const LAZY_SRCSET_ATTRS = ["data-srcset", "data-lazy-srcset", "data-sizes-srcset"] as const;

class ArticleLoadError extends TaggedError("ArticleLoadError")<{
  message: string;
  status?: number;
  cause?: unknown;
}>() {}

const siteViewDocumentInputSchema = z.object({
  url: z.string().url(),
});

const readResponseBody = async (response: Response) => {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        chunks.push(decoder.decode());
        break;
      }

      bytesRead += value.byteLength;

      if (bytesRead > MAX_BODY_BYTES) {
        chunks.push(decoder.decode(value));
        reader.cancel();
        break;
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }

  return chunks.join("");
};

const fetchArticleHtml = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return unwrapOrThrow(
      await Result.tryPromise(
        {
          try: async () => {
            const response = await fetch(url, {
              headers: FETCH_HEADERS,
              redirect: "follow",
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new ArticleLoadError({
                message: `The article request failed with status ${response.status}.`,
                status: response.status,
              });
            }

            return {
              html: await readResponseBody(response),
              finalUrl: response.url,
            };
          },
          catch: (cause) => {
            if (ArticleLoadError.is(cause)) {
              return cause;
            }

            if (cause instanceof Error && cause.name === "AbortError") {
              return new ArticleLoadError({
                message: "The article took too long to respond.",
                cause,
              });
            }

            return new ArticleLoadError({
              message:
                cause instanceof Error && cause.message
                  ? cause.message
                  : "The article could not be loaded.",
              cause,
            });
          },
        },
        {
          retry: {
            times: 1,
            delayMs: 150,
            backoff: "constant",
            shouldRetry: (error) => error.status !== 404,
          },
        },
      ),
    );
  } finally {
    clearTimeout(timeout);
  }
};

const pickAttribute = (
  element: Element,
  attributes: readonly string[],
  predicate?: (value: string) => boolean,
) => {
  for (const attr of attributes) {
    const value = element.getAttribute(attr)?.trim();

    if (!value) {
      continue;
    }

    if (!predicate || predicate(value)) {
      return value;
    }
  }
};

const isNotDataUri = (value: string) => !value.startsWith("data:");

const normalizeContent = (html: string | undefined, baseUrl: string) => {
  if (!html) {
    return undefined;
  }

  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

  for (const el of document.querySelectorAll(NAV_SELECTOR)) {
    el.remove();
  }

  for (const el of document.querySelectorAll(CLUTTER_SELECTOR)) {
    if (REMOVABLE_CONTAINERS.has(el.tagName)) {
      el.remove();
    }
  }

  for (const el of document.querySelectorAll(MEDIA_SELECTOR)) {
    if ((el.tagName === "IMG" || el.tagName === "SOURCE") && !el.getAttribute("srcset")) {
      const srcset = pickAttribute(el, LAZY_SRCSET_ATTRS);

      if (srcset) {
        el.setAttribute("srcset", srcset);
      }
    }

    const src = pickAttribute(el, LAZY_SRC_ATTRS, isNotDataUri);

    if (src) {
      el.setAttribute("src", resolveUrl(src, baseUrl) ?? src);
    }

    const poster = el.getAttribute("poster")?.trim() || el.getAttribute("data-poster")?.trim();

    if (poster) {
      el.setAttribute("poster", resolveUrl(poster, baseUrl) ?? poster);
    }
  }

  for (const el of document.querySelectorAll("a[href]")) {
    const href = el.getAttribute("href")?.trim();

    if (
      href &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("javascript:")
    ) {
      const resolved = resolveUrl(href, baseUrl);

      if (resolved) {
        el.setAttribute("href", resolved);
      }
    }
  }

  return document.body.innerHTML;
};

const getPlainText = (value: string | undefined) => stripHtml(value) ?? "";

const countMatches = (value: string | undefined, pattern: RegExp) =>
  value ? (value.match(pattern) ?? []).length : 0;

const getLinkDensity = (html: string | undefined, textLength: number) => {
  if (!html || textLength === 0) {
    return 0;
  }

  const linkTextLength = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].reduce(
    (total, match) => total + getPlainText(match[1]).length,
    0,
  );

  return linkTextLength / textLength;
};

const isProbablyExcerpt = ({
  textLength,
  excerptLength,
  paragraphCount,
}: {
  textLength: number;
  excerptLength: number;
  paragraphCount: number;
}) =>
  (excerptLength > 0 && textLength <= Math.max(excerptLength * 1.35, 220)) ||
  (textLength < 260 && paragraphCount < 2);

const buildFeedHtmlCandidate = (item: {
  title: string;
  excerpt?: string;
  url: string;
  contentHtml?: string;
  contentText?: string;
  publishedAt?: string;
  author?: string;
  imageUrl?: string;
}) => {
  const contentHtml = sanitizeReaderHtml(normalizeContent(item.contentHtml, item.url), item.url);

  if (!contentHtml) {
    return;
  }

  const text = getPlainText(contentHtml);
  const excerptLength = getPlainText(item.excerpt).length;
  const paragraphCount = countMatches(contentHtml, /<p\b/gi);
  const blockCount = countMatches(
    contentHtml,
    /<(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|figure|img|video|iframe)\b/gi,
  );
  const linkDensity = getLinkDensity(contentHtml, text.length);
  const isUsable =
    text.length >= MIN_FEED_HTML_LENGTH &&
    (paragraphCount >= 2 || blockCount >= 5) &&
    linkDensity <= MAX_LINK_DENSITY &&
    !isProbablyExcerpt({
      textLength: text.length,
      excerptLength,
      paragraphCount,
    });

  return {
    isUsable,
    article: extractedReaderArticleSchema.parse({
      title: item.title,
      excerpt: item.excerpt,
      contentHtml,
      publishedAt: item.publishedAt,
      author: item.author,
      imageUrl: item.imageUrl,
    }),
  };
};

const buildFeedTextCandidate = (item: {
  title: string;
  excerpt?: string;
  contentText?: string;
  publishedAt?: string;
  author?: string;
  imageUrl?: string;
}) => {
  const contentText = item.contentText?.trim();

  if (!contentText) {
    return;
  }

  const textLength = contentText.length;
  const excerptLength = getPlainText(item.excerpt).length;
  const paragraphCount = contentText
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const isUsable =
    textLength >= MIN_FEED_TEXT_LENGTH &&
    paragraphCount >= 2 &&
    !isProbablyExcerpt({
      textLength,
      excerptLength,
      paragraphCount,
    });

  return {
    isUsable,
    article: extractedReaderArticleSchema.parse({
      title: item.title,
      excerpt: item.excerpt,
      contentText,
      publishedAt: item.publishedAt,
      author: item.author,
      imageUrl: item.imageUrl,
    }),
  };
};

const pickMetaContent = (document: Document, selectors: readonly string[]) => {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")?.trim();

    if (value) {
      return value;
    }
  }
};

const extractWithReadability = (html: string, url: string) => {
  const { document } = parseHTML(html);
  const metadata = {
    image: pickMetaContent(document, [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
    ]),
    author: pickMetaContent(document, ['meta[name="author"]', 'meta[property="article:author"]']),
    publishedAt: pickMetaContent(document, [
      'meta[property="article:published_time"]',
      'meta[name="article:published_time"]',
      'meta[name="publish_date"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
    ]),
  };
  const reader = new Readability(document, {
    charThreshold: 20,
  });
  const result = reader.parse();

  if (!result) {
    return;
  }

  const contentHtml = sanitizeReaderHtml(normalizeContent(result.content || undefined, url), url);
  const text = getPlainText(contentHtml);

  if (text.length < MIN_READABILITY_LENGTH) {
    return;
  }

  return {
    title: result.title?.trim() || undefined,
    excerpt: createExcerpt(result.excerpt?.trim()) || undefined,
    contentHtml,
    publishedAt:
      normalizeOptionalDate(result.publishedTime) ??
      normalizeOptionalDate(metadata.publishedAt) ??
      undefined,
    author: result.byline?.trim() || metadata.author,
    imageUrl: resolveUrl(metadata.image, url) ?? metadata.image ?? undefined,
  };
};

const buildSiteViewDocument = ({ html, finalUrl }: { html: string; finalUrl: string }) => {
  const { document } = parseHTML(html);
  const head = document.head ?? document.createElement("head");
  const body = document.body ?? document.createElement("body");

  if (!document.head) {
    document.documentElement.prepend(head);
  }

  if (!document.body) {
    document.documentElement.append(body);
  }

  for (const element of document.querySelectorAll("base")) {
    element.remove();
  }

  for (const element of document.querySelectorAll("meta[http-equiv]")) {
    const httpEquiv = element.getAttribute("http-equiv")?.trim().toLowerCase();

    if (
      httpEquiv === "content-security-policy" ||
      httpEquiv === "x-frame-options" ||
      httpEquiv === "refresh"
    ) {
      element.remove();
    }
  }

  const base = document.createElement("base");
  base.setAttribute("href", finalUrl);
  head.prepend(base);

  return {
    html: `<!DOCTYPE html>${document.documentElement.outerHTML}`,
    finalUrl,
  };
};

const extractReaderArticle = async (input: {
  item: {
    title: string;
    excerpt?: string;
    url: string;
    contentHtml?: string;
    contentText?: string;
    publishedAt?: string;
    author?: string;
    imageUrl?: string;
  };
}) => {
  const { item } = input;
  const feedHtml = buildFeedHtmlCandidate(item);

  if (feedHtml?.isUsable) {
    return feedHtml.article;
  }

  const feedText = buildFeedTextCandidate(item);

  if (feedText?.isUsable) {
    return feedText.article;
  }

  const fallbackArticle = extractedReaderArticleSchema.parse({
    title: item.title,
    excerpt: item.excerpt,
    contentHtml: feedHtml?.article.contentHtml,
    contentText: feedHtml ? undefined : (feedText?.article.contentText ?? item.contentText),
    publishedAt: item.publishedAt,
    author: item.author,
    imageUrl: item.imageUrl,
  });

  const extractedArticle = await Result.tryPromise({
    try: async () => {
      const fetched = await fetchArticleHtml(item.url);
      const readable = extractWithReadability(fetched.html, fetched.finalUrl);

      if (!readable) {
        return fallbackArticle;
      }

      return extractedReaderArticleSchema.parse({
        title: readable.title || item.title,
        excerpt: readable.excerpt ?? item.excerpt,
        contentHtml: readable.contentHtml,
        publishedAt: readable.publishedAt ?? item.publishedAt,
        author: readable.author || item.author,
        imageUrl: readable.imageUrl ?? item.imageUrl,
      });
    },
    catch: (cause) =>
      ArticleLoadError.is(cause)
        ? cause
        : new ArticleLoadError({
            message: "The article could not be extracted.",
            cause,
          }),
  });

  return extractedArticle.match({
    ok: (article) => article,
    err: (error) => {
      if (fallbackArticle.contentHtml || fallbackArticle.contentText) {
        return fallbackArticle;
      }

      throw error;
    },
  });
};

export const loadReaderArticle = createServerFn({ method: "POST" })
  .inputValidator(extractReaderArticleInputSchema)
  .handler(async ({ data }) => extractReaderArticle(data));

export const loadSiteViewDocument = createServerFn({ method: "POST" })
  .inputValidator(siteViewDocumentInputSchema)
  .handler(async ({ data }) => buildSiteViewDocument(await fetchArticleHtml(data.url)));
