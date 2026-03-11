import { XMLParser } from "fast-xml-parser";
import type { SourceKind, StoredFeedItem } from "@/lib/types";
import {
  createExcerpt,
  createFeedItemId,
  dedupeItems,
  normalizeOptionalDate,
  resolveUrl,
  sortItemsNewestFirst,
  stripHtml,
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
    pickText(candidate["content"]) ??
    pickText(candidate["value"])
  );
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
    if (typeof candidate === "string") {
      const resolved = resolveUrl(candidate, baseUrl);

      if (resolved) {
        return resolved;
      }
    }
  }

  return undefined;
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
          const excerpt = createExcerpt(
            pickText(item.description) ??
              pickText(item["content:encoded"]) ??
              pickText(item.summary),
          );

          return {
            id: createFeedItemId(sourceId, [pickText(item.guid), url, title, publishedAt]),
            sourceId,
            url,
            title,
            excerpt,
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

    if (typeof link === "object" && link) {
      const linkRecord = link as Record<string, unknown>;
      const href = typeof linkRecord.href === "string" ? linkRecord.href : undefined;
      const candidateRel = typeof linkRecord.rel === "string" ? linkRecord.rel : "alternate";
      const rels = candidateRel.split(/\s+/);

      if (href && rels.includes(rel)) {
        const resolved = resolveUrl(href, baseUrl);

        if (resolved) {
          return resolved;
        }
      }
    }
  }

  return undefined;
};

const pickAtomLink = (value: unknown, baseUrl: string) => pickAtomLinkByRel(value, baseUrl);

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
          const content = pickText(item.content) ?? pickText(item.summary);
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
            excerpt: createExcerpt(content),
            publishedAt,
            author,
            imageUrl: pickImageUrl(item, baseUrl),
          } satisfies StoredFeedItem;
        })
        .filter((item) => item !== undefined),
    ),
  );

const normalizeJsonFeedItems = (
  sourceId: string,
  baseUrl: string,
  items: Array<Record<string, unknown>>,
) =>
  sortItemsNewestFirst(
    dedupeItems(
      items
        .map((item) => {
          const url =
            resolveUrl(typeof item.url === "string" ? item.url : undefined, baseUrl) ??
            resolveUrl(
              typeof item.external_url === "string" ? item.external_url : undefined,
              baseUrl,
            );

          if (!url) {
            return undefined;
          }

          const title =
            (typeof item.title === "string" ? item.title.trim() : undefined) ??
            getFallbackTitleFromUrl(url);
          const content =
            (typeof item.summary === "string" ? item.summary : undefined) ??
            (typeof item.content_text === "string" ? item.content_text : undefined) ??
            (typeof item.content_html === "string" ? item.content_html : undefined);
          const author = asArray<Record<string, unknown>>(
            item.authors as Array<Record<string, unknown>> | undefined,
          )
            .map((candidate) => (typeof candidate?.name === "string" ? candidate.name : undefined))
            .find(Boolean);

          return {
            id: createFeedItemId(sourceId, [
              typeof item.id === "string" ? item.id : undefined,
              url,
              title,
            ]),
            sourceId,
            url,
            title,
            excerpt: createExcerpt(content),
            publishedAt:
              normalizeOptionalDate(
                typeof item.date_published === "string" ? item.date_published : undefined,
              ) ??
              normalizeOptionalDate(
                typeof item.date_modified === "string" ? item.date_modified : undefined,
              ),
            author,
            imageUrl: resolveUrl(typeof item.image === "string" ? item.image : undefined, baseUrl),
          } satisfies StoredFeedItem;
        })
        .filter((item) => item !== undefined),
    ),
  );

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

export const looksLikeFeedDocument = (contentType: string, body: string) => {
  const loweredType = contentType.toLowerCase();
  const loweredBody = body.slice(0, 250).toLowerCase();

  return (
    loweredType.includes("xml") ||
    loweredType.includes("rss") ||
    loweredType.includes("atom") ||
    loweredType.includes("json") ||
    loweredBody.startsWith("<?xml") ||
    loweredBody.includes("<rss") ||
    loweredBody.includes("<feed") ||
    loweredBody.startsWith("{")
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
}) => {
  const trimmed = body.trim();

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const feedUrl =
      resolveUrl(typeof parsed.feed_url === "string" ? parsed.feed_url : undefined, baseUrl) ??
      baseUrl;
    const siteUrl =
      resolveUrl(
        typeof parsed.home_page_url === "string" ? parsed.home_page_url : undefined,
        baseUrl,
      ) ?? baseUrl;

    return {
      kind: "feed" as SourceKind,
      label:
        (typeof parsed.title === "string" ? parsed.title.trim() : undefined) ??
        new URL(siteUrl).hostname.replace(/^www\./, ""),
      siteUrl,
      feedUrl,
      nextPageUrl: resolveUrl(
        typeof parsed.next_url === "string" ? parsed.next_url : undefined,
        baseUrl,
      ),
      items: normalizeJsonFeedItems(
        sourceId,
        siteUrl,
        asArray(parsed.items as Array<Record<string, unknown>> | undefined),
      ),
    };
  }

  const parsed = xmlParser.parse(trimmed) as Record<string, unknown>;

  if (parsed.rss || parsed["rdf:RDF"]) {
    const rss = (parsed.rss ?? parsed["rdf:RDF"]) as Record<string, unknown>;
    const channel = (rss.channel ?? rss) as Record<string, unknown>;
    const siteUrl = resolveUrl(pickText(channel.link), baseUrl) ?? baseUrl;

    return {
      kind: "feed" as SourceKind,
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
      kind: "feed" as SourceKind,
      label: pickText(feed.title) ?? new URL(siteUrl).hostname.replace(/^www\./, ""),
      siteUrl,
      feedUrl: baseUrl,
      nextPageUrl: pickAtomLinkByRel(feed.link, baseUrl, "next"),
      items: normalizeAtomItems(sourceId, siteUrl, asArray(feed.entry)),
    };
  }

  throw new Error("The feed could not be parsed.");
};

export const createFallbackEntryFromArticle = ({
  sourceId,
  url,
  title,
  excerpt,
  publishedAt,
  author,
  imageUrl,
}: {
  sourceId: string;
  url: string;
  title: string;
  excerpt?: string;
  publishedAt?: string;
  author?: string;
  imageUrl?: string;
}) =>
  ({
    id: createFeedItemId(sourceId, [url, title, publishedAt]),
    sourceId,
    url,
    title,
    excerpt: excerpt ? stripHtml(excerpt) : undefined,
    publishedAt,
    author,
    imageUrl,
  }) satisfies StoredFeedItem;
