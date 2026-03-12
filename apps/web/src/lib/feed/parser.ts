import { XMLParser } from "fast-xml-parser";
import type { FetchedFeedSource, StoredFeedItem } from "@/lib/types";
import {
  createExcerpt,
  createFeedItemId,
  dedupeItems,
  normalizeOptionalDate,
  resolveUrl,
  sortItemsNewestFirst,
} from "@/lib/feed/utils";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  cdataPropName: "cdata",
  trimValues: true,
});

const asArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const pickText = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim() || undefined;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  return (
    pickText(candidate.text) ??
    pickText(candidate.cdata) ??
    pickText(candidate["#text"]) ??
    pickText(candidate.content) ??
    pickText(candidate.value)
  );
};

const looksLikeHtml = (value: string | undefined) => Boolean(value && /<[^>]+>/.test(value));

const getFallbackTitleFromUrl = (urlValue: string) => {
  const url = new URL(urlValue);
  const slug = url.pathname.split("/").filter(Boolean).at(-1);

  if (!slug) {
    return url.hostname;
  }

  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const pickImageUrl = (entry: Record<string, unknown>, baseUrl: string) => {
  const mediaContent = asArray<Record<string, unknown>>(
    entry["media:content"] as Record<string, unknown> | undefined,
  );
  const mediaThumbnail = asArray<Record<string, unknown>>(
    entry["media:thumbnail"] as Record<string, unknown> | undefined,
  );
  const enclosure = asArray<Record<string, unknown>>(
    entry.enclosure as Record<string, unknown> | undefined,
  );

  const candidates = [
    ...mediaContent.map((item) => item.url),
    ...mediaThumbnail.map((item) => item.url),
    ...enclosure
      .filter((item) => typeof item.type === "string" && item.type.startsWith("image"))
      .map((item) => item.url),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const resolved = resolveUrl(candidate, baseUrl);

    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const resolveFeedContent = (content: string | undefined, treatAsHtml: boolean) =>
  treatAsHtml
    ? {
        contentHtml: content,
        contentText: undefined,
      }
    : {
        contentHtml: undefined,
        contentText: content,
      };

const normalizeRssItems = (sourceId: string, baseUrl: string, items: unknown[]) =>
  sortItemsNewestFirst(
    dedupeItems(
      items
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return undefined;
          }

          const item = entry as Record<string, unknown>;
          const url =
            resolveUrl(pickText(item.link), baseUrl) ?? resolveUrl(pickText(item.guid), baseUrl);

          if (!url) {
            return undefined;
          }

          const title = pickText(item.title) ?? getFallbackTitleFromUrl(url);
          const publishedAt =
            normalizeOptionalDate(pickText(item.pubDate)) ??
            normalizeOptionalDate(pickText(item.date)) ??
            normalizeOptionalDate(pickText(item.published));
          const rawContent = pickText(item["content:encoded"]) ?? pickText(item.description);
          const content = resolveFeedContent(
            rawContent,
            item["content:encoded"] !== undefined || looksLikeHtml(rawContent),
          );
          const excerpt =
            createExcerpt(
              pickText(item.description) ??
                pickText(item.summary) ??
                content.contentText ??
                rawContent,
            ) ?? createExcerpt(content.contentHtml);

          return {
            id: createFeedItemId(sourceId, [pickText(item.guid), url, title, publishedAt]),
            sourceId,
            url,
            title,
            excerpt,
            ...content,
            publishedAt,
            author: pickText(item.author) ?? pickText(item["dc:creator"]),
            imageUrl: pickImageUrl(item, baseUrl),
          } satisfies StoredFeedItem;
        })
        .filter((item) => item !== undefined),
    ),
  );

const pickAtomLinkByRel = (value: unknown, baseUrl: string, rel = "alternate") => {
  const links = asArray(value as Record<string, unknown> | undefined);

  for (const link of links) {
    if (typeof link === "string") {
      if (rel !== "alternate") {
        continue;
      }

      const resolved = resolveUrl(link, baseUrl);

      if (resolved) {
        return resolved;
      }
    }

    if (typeof link !== "object" || !link) {
      continue;
    }

    const linkRecord = link as Record<string, unknown>;
    const href = typeof linkRecord.href === "string" ? linkRecord.href : undefined;
    const candidateRel = typeof linkRecord.rel === "string" ? linkRecord.rel : "alternate";
    const rels = candidateRel.split(/\s+/);

    if (!href || !rels.includes(rel)) {
      continue;
    }

    const resolved = resolveUrl(href, baseUrl);

    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const pickAtomLink = (value: unknown, baseUrl: string) => pickAtomLinkByRel(value, baseUrl);

const getAtomContentValue = (value: unknown) => {
  const content = value as Record<string, unknown> | undefined;
  const text = pickText(value);
  const type = typeof content?.type === "string" ? content.type.toLowerCase() : undefined;
  const treatAsHtml =
    type === "html" ||
    type === "xhtml" ||
    (type === "text/html" && Boolean(text)) ||
    looksLikeHtml(text);

  return {
    text,
    treatAsHtml,
  };
};

const normalizeAtomItems = (sourceId: string, baseUrl: string, items: unknown[]) =>
  sortItemsNewestFirst(
    dedupeItems(
      items
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return undefined;
          }

          const item = entry as Record<string, unknown>;
          const url = pickAtomLink(item.link, baseUrl);

          if (!url) {
            return undefined;
          }

          const title = pickText(item.title) ?? getFallbackTitleFromUrl(url);
          const contentValue = getAtomContentValue(item.content);
          const summary = pickText(item.summary);
          const content =
            contentValue.text !== undefined
              ? resolveFeedContent(contentValue.text, contentValue.treatAsHtml)
              : resolveFeedContent(summary, false);
          const publishedAt =
            normalizeOptionalDate(pickText(item.updated)) ??
            normalizeOptionalDate(pickText(item.published));
          const author = asArray<Record<string, unknown>>(
            item.author as Record<string, unknown> | undefined,
          )
            .map((candidate) => pickText(candidate.name) ?? pickText(candidate))
            .find(Boolean);

          return {
            id: createFeedItemId(sourceId, [pickText(item.id), url, title, publishedAt]),
            sourceId,
            url,
            title,
            excerpt: createExcerpt(summary ?? content.contentText ?? content.contentHtml),
            ...content,
            publishedAt,
            author,
            imageUrl: pickImageUrl(item, baseUrl),
          } satisfies StoredFeedItem;
        })
        .filter((item) => item !== undefined),
    ),
  );

export const looksLikeFeedDocument = (contentType: string, body: string) => {
  const loweredType = contentType.toLowerCase();
  const loweredBody = body.slice(0, 250).toLowerCase();

  return (
    loweredType.includes("xml") ||
    loweredType.includes("rss") ||
    loweredType.includes("atom") ||
    loweredBody.startsWith("<?xml") ||
    loweredBody.includes("<rss") ||
    loweredBody.includes("<feed")
  );
};

export const parseFeedDocument = ({
  body,
  baseUrl,
  sourceId,
}: {
  body: string;
  baseUrl: string;
  sourceId: string;
}): FetchedFeedSource => {
  const trimmed = body.trim();
  const parsed = xmlParser.parse(trimmed) as Record<string, unknown>;

  if (parsed.rss || parsed["rdf:RDF"]) {
    const rss = (parsed.rss ?? parsed["rdf:RDF"]) as Record<string, unknown>;
    const channel = (rss.channel ?? rss) as Record<string, unknown>;
    const siteUrl = resolveUrl(pickText(channel.link), baseUrl) ?? baseUrl;

    return {
      sourceId,
      label: pickText(channel.title) ?? new URL(siteUrl).hostname.replace(/^www\./, ""),
      siteUrl,
      feedUrl: baseUrl,
      items: normalizeRssItems(sourceId, siteUrl, asArray(channel.item)),
    };
  }

  if (parsed.feed) {
    const feed = parsed.feed as Record<string, unknown>;
    const siteUrl = pickAtomLink(feed.link, baseUrl) ?? baseUrl;

    return {
      sourceId,
      label: pickText(feed.title) ?? new URL(siteUrl).hostname.replace(/^www\./, ""),
      siteUrl,
      feedUrl: baseUrl,
      nextPageUrl: pickAtomLinkByRel(feed.link, baseUrl, "next"),
      items: normalizeAtomItems(sourceId, siteUrl, asArray(feed.entry)),
    };
  }

  throw new Error(
    "Paste a direct RSS or Atom feed URL. Homepages and JSON feeds are not supported.",
  );
};
