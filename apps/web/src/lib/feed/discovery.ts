import createDOMPurify from "dompurify";
import { Defuddle } from "defuddle/node";
import { JSDOM } from "jsdom";
import {
  clampArray,
  createExcerpt,
  normalizeOptionalDate,
  resolveUrl,
  stripHtml,
} from "@/lib/feed/utils";
import { createFallbackEntryFromArticle } from "@/lib/feed/parser";

type DomPurifyWindow = Parameters<typeof createDOMPurify>[0];

const feedTypePriority = [
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json",
  "application/xml",
  "text/xml",
];

const cleanText = (value: string | undefined) => value?.replace(/\s+/g, " ").trim();

const scoreFeedLink = (type: string, url: string, siteHostname: string) => {
  const typeIndex = feedTypePriority.findIndex((entry) => type.includes(entry));
  const hostBoost = new URL(url).hostname === siteHostname ? -5 : 0;

  return (typeIndex === -1 ? 99 : typeIndex) + hostBoost;
};

export const discoverFeedLinksFromHtml = (html: string, baseUrl: string) => {
  const dom = new JSDOM(html, { url: baseUrl });
  const document = dom.window.document;
  const siteHostname = new URL(baseUrl).hostname;
  const links = [...document.querySelectorAll("link[rel~='alternate'][href]")]
    .map((element) => {
      const href = element.getAttribute("href");
      const type = element.getAttribute("type")?.toLowerCase() ?? "";

      if (!href) {
        return undefined;
      }

      const resolvedUrl = resolveUrl(href, baseUrl);

      if (!resolvedUrl) {
        return undefined;
      }

      return {
        url: resolvedUrl,
        type,
        title: cleanText(element.getAttribute("title") ?? undefined),
      };
    })
    .filter((entry) => entry !== undefined)
    .sort(
      (left, right) =>
        scoreFeedLink(left.type, left.url, siteHostname) -
        scoreFeedLink(right.type, right.url, siteHostname),
    );

  const siteTitle =
    cleanText(
      document.querySelector("meta[property='og:site_name']")?.getAttribute("content") ?? undefined,
    ) ?? cleanText(document.querySelector("title")?.textContent ?? undefined);

  const canonicalUrl =
    resolveUrl(
      document.querySelector("link[rel='canonical']")?.getAttribute("href") ?? undefined,
      baseUrl,
    ) ?? baseUrl;

  dom.window.close();

  return {
    siteTitle,
    canonicalUrl,
    feedLinks: links,
  };
};

const isLikelyArticleLink = (url: URL, baseUrl: URL) => {
  if (url.hash || url.protocol.startsWith("mailto") || url.protocol.startsWith("javascript")) {
    return false;
  }

  if (url.hostname !== baseUrl.hostname) {
    return false;
  }

  const path = url.pathname.toLowerCase();

  if (path === "/" || path.split("/").filter(Boolean).length < 1) {
    return false;
  }

  if (/\/(about|contact|privacy|terms|tags|category|categories|authors?)\/?$/.test(path)) {
    return false;
  }

  return true;
};

const getArticleCandidate = (container: Element, sourceId: string, baseUrl: string) => {
  const headingLink =
    container.querySelector("h1 a[href], h2 a[href], h3 a[href], h4 a[href]") ??
    container.querySelector("a[href]");

  if (!headingLink) {
    return undefined;
  }

  const url = resolveUrl(headingLink.getAttribute("href") ?? undefined, baseUrl);

  if (!url) {
    return undefined;
  }

  const articleUrl = new URL(url);

  if (!isLikelyArticleLink(articleUrl, new URL(baseUrl))) {
    return undefined;
  }

  const title = cleanText(headingLink.textContent ?? undefined);

  if (!title || title.length < 5) {
    return undefined;
  }

  const excerpt =
    cleanText(container.querySelector("p")?.textContent ?? undefined) ??
    cleanText(container.querySelector("[data-excerpt]")?.textContent ?? undefined);
  const publishedAt = normalizeOptionalDate(
    container.querySelector("time")?.getAttribute("datetime") ??
      container.querySelector("time")?.textContent ??
      undefined,
  );
  const author = cleanText(
    container.querySelector("[rel='author']")?.textContent ??
      container.querySelector("[class*='author']")?.textContent ??
      undefined,
  );
  const imageUrl = resolveUrl(
    container.querySelector("img")?.getAttribute("src") ??
      container.querySelector("img")?.getAttribute("data-src") ??
      undefined,
    baseUrl,
  );

  return createFallbackEntryFromArticle({
    sourceId,
    url,
    title,
    excerpt,
    publishedAt,
    author,
    imageUrl,
  });
};

export const scrapeLatestFromHtml = ({
  html,
  baseUrl,
  sourceId,
}: {
  html: string;
  baseUrl: string;
  sourceId: string;
}) => {
  const dom = new JSDOM(html, { url: baseUrl });
  const document = dom.window.document;
  const containers = [
    ...document.querySelectorAll("article"),
    ...document.querySelectorAll(
      "main li, main section, main div[data-post], main .post, main .entry",
    ),
  ];
  const primaryCandidates = containers
    .map((container) => getArticleCandidate(container, sourceId, baseUrl))
    .filter((candidate) => candidate !== undefined);
  const fallbackCandidates = [...document.querySelectorAll("main a[href], a[href]")]
    .map((element) => {
      const href = element.getAttribute("href");
      const title = cleanText(element.textContent ?? undefined);

      if (!href || !title || title.length < 12) {
        return undefined;
      }

      const url = resolveUrl(href, baseUrl);

      if (!url) {
        return undefined;
      }

      const articleUrl = new URL(url);

      if (!isLikelyArticleLink(articleUrl, new URL(baseUrl))) {
        return undefined;
      }

      return createFallbackEntryFromArticle({
        sourceId,
        url,
        title,
      });
    })
    .filter((candidate) => candidate !== undefined);

  const siteTitle =
    cleanText(
      document.querySelector("meta[property='og:site_name']")?.getAttribute("content") ?? undefined,
    ) ?? cleanText(document.querySelector("title")?.textContent ?? undefined);

  dom.window.close();

  return {
    siteTitle,
    items: clampArray(
      [
        ...new Map(
          [...primaryCandidates, ...fallbackCandidates].map((candidate) => [
            candidate.url,
            candidate,
          ]),
        ).values(),
      ],
      16,
    ),
  };
};

export const extractArticleFromHtml = async ({
  html,
  url,
  itemId,
}: {
  html: string;
  url: string;
  itemId: string;
}) => {
  const dom = new JSDOM(html, { url });
  const purifier = createDOMPurify(dom.window as unknown as DomPurifyWindow);
  const article = await Defuddle(dom, url, { useAsync: false });
  const excerpt =
    createExcerpt(
      article.description ||
        (dom.window.document.querySelector("meta[name='description']")?.getAttribute("content") ??
          dom.window.document
            .querySelector("meta[property='og:description']")
            ?.getAttribute("content") ??
          undefined),
      220,
    ) ?? undefined;
  const fallbackTitle =
    cleanText(dom.window.document.querySelector("title")?.textContent ?? undefined) ??
    "Original article";
  const publishedAt = normalizeOptionalDate(
    article.published ||
      (dom.window.document
        .querySelector("meta[property='article:published_time']")
        ?.getAttribute("content") ??
        dom.window.document.querySelector("time")?.getAttribute("datetime") ??
        undefined),
  );

  const contentHtml = article.content ? purifier.sanitize(article.content) : undefined;
  const contentText = stripHtml(contentHtml ?? "");

  if (!contentText?.trim()) {
    dom.window.close();

    return {
      itemId,
      url,
      title: fallbackTitle,
      excerpt,
      publishedAt,
      fallbackReason: "A clean reader view could not be extracted for this page.",
    };
  }

  const wordCount = article.wordCount || contentText.split(/\s+/).length;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));

  dom.window.close();

  return {
    itemId,
    url,
    title: cleanText(article.title) || "Untitled article",
    byline: cleanText(article.author) || undefined,
    publishedAt,
    contentHtml,
    excerpt,
    readTimeMinutes,
  };
};
