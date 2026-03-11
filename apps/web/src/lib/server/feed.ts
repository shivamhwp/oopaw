import { createServerFn } from "@tanstack/react-start";
import {
  discoverSourceInputSchema,
  fetchArticleInputSchema,
  loadMoreSourceItemsInputSchema,
  POLL_INTERVAL_MS,
  refreshSourceInputSchema,
  type ArticleEmbedStatus,
  type DiscoveryResult,
  type LoadMoreSourceItemsResult,
  type ReaderArticle,
  type RefreshResult,
} from "@/lib/types";
import {
  discoverFeedLinksFromHtml,
  extractArticleFromHtml,
  scrapeLatestFromHtml,
} from "@/lib/feed/discovery";
import { hasEmbedPolicyHeaders, inspectEmbedHeaders } from "@/lib/feed/embed";
import { looksLikeFeedDocument, parseFeedDocument } from "@/lib/feed/parser";
import { createSourceId, getHostnameLabel, normalizeInputUrl } from "@/lib/feed/utils";

const feedRequestHeaders = {
  "user-agent": "Papertrail Feed Reader/1.0 (+local)",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/atom+xml;q=0.9,application/rss+xml;q=0.9,application/feed+json;q=0.8,*/*;q=0.6",
};

const fetchRemoteDocument = async (url: string) => {
  const response = await fetch(url, {
    headers: feedRequestHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return {
    body: await response.text(),
    finalUrl: response.url,
    contentType: response.headers.get("content-type") ?? "",
  };
};

const fetchRemoteResponse = async (url: string, method: "GET" | "HEAD") =>
  fetch(url, {
    method,
    headers: feedRequestHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });

const parseFeedAtUrl = async (url: string) => {
  const document = await fetchRemoteDocument(url);
  const sourceId = createSourceId(document.finalUrl);
  const parsed = parseFeedDocument({
    body: document.body,
    baseUrl: document.finalUrl,
    sourceId,
  });

  return {
    sourceId,
    ...parsed,
  };
};

const discoverFromHtml = async (inputUrl: string) => {
  const document = await fetchRemoteDocument(inputUrl);

  if (looksLikeFeedDocument(document.contentType, document.body)) {
    return parseFeedAtUrl(document.finalUrl);
  }

  const discovery = discoverFeedLinksFromHtml(document.body, document.finalUrl);
  const feedLink = discovery.feedLinks[0]?.url;

  if (feedLink) {
    const feed = await parseFeedAtUrl(feedLink);

    return {
      ...feed,
      siteUrl: discovery.canonicalUrl,
      label: feed.label || discovery.siteTitle || getHostnameLabel(discovery.canonicalUrl),
    };
  }

  const sourceId = createSourceId(discovery.canonicalUrl);
  const scraped = scrapeLatestFromHtml({
    html: document.body,
    baseUrl: discovery.canonicalUrl,
    sourceId,
  });

  if (!scraped.items.length) {
    throw new Error("No feed or recent article links were detected on this site.");
  }

  return {
    sourceId,
    kind: "scrape" as const,
    label: scraped.siteTitle || discovery.siteTitle || getHostnameLabel(discovery.canonicalUrl),
    siteUrl: discovery.canonicalUrl,
    feedUrl: undefined,
    nextPageUrl: undefined,
    items: scraped.items,
  };
};

export const discoverSource = createServerFn({ method: "POST" })
  .inputValidator(discoverSourceInputSchema)
  .handler(async ({ data }): Promise<DiscoveryResult> => {
    const normalizedInput = normalizeInputUrl(data.input);
    const discovered = await discoverFromHtml(normalizedInput);
    const checkedAt = new Date().toISOString();

    return {
      source: {
        id: discovered.sourceId,
        label: discovered.label,
        inputUrl: normalizedInput,
        siteUrl: discovered.siteUrl,
        feedUrl: discovered.feedUrl,
        kind: discovered.kind,
        pollingEnabled: true,
        pollIntervalMs: POLL_INTERVAL_MS,
        lastCheckedAt: checkedAt,
      },
      items: discovered.items,
      checkedAt,
      nextPageUrl: discovered.nextPageUrl,
    };
  });

export const refreshSource = createServerFn({ method: "POST" })
  .inputValidator(refreshSourceInputSchema)
  .handler(async ({ data }): Promise<RefreshResult> => {
    const checkedAt = new Date().toISOString();
    const seenIds = new Set(data.seenItemIds);

    if (data.source.kind === "feed") {
      if (!data.source.feedUrl) {
        throw new Error("This source does not have a feed URL to refresh.");
      }

      const feed = await parseFeedAtUrl(data.source.feedUrl);

      return {
        sourceId: data.source.id,
        items: feed.items.map((item) => ({
          ...item,
          sourceId: data.source.id,
        })),
        newCount: feed.items.filter((item) => !seenIds.has(item.id)).length,
        checkedAt,
        nextPageUrl: feed.nextPageUrl,
      };
    }

    const document = await fetchRemoteDocument(data.source.siteUrl);
    const scraped = scrapeLatestFromHtml({
      html: document.body,
      baseUrl: document.finalUrl,
      sourceId: data.source.id,
    });

    return {
      sourceId: data.source.id,
      items: scraped.items,
      newCount: scraped.items.filter((item) => !seenIds.has(item.id)).length,
      checkedAt,
      nextPageUrl: undefined,
    };
  });

export const loadMoreSourceItems = createServerFn({ method: "POST" })
  .inputValidator(loadMoreSourceItemsInputSchema)
  .handler(async ({ data }): Promise<LoadMoreSourceItemsResult> => {
    if (data.source.kind !== "feed") {
      throw new Error("This source does not support feed pagination.");
    }

    const page = await parseFeedAtUrl(data.pageUrl);

    return {
      sourceId: data.source.id,
      pageUrl: data.pageUrl,
      items: page.items.map((item) => ({
        ...item,
        sourceId: data.source.id,
      })),
      nextPageUrl: page.nextPageUrl,
    };
  });

export const fetchArticle = createServerFn({ method: "POST" })
  .inputValidator(fetchArticleInputSchema)
  .handler(async ({ data }): Promise<ReaderArticle> => {
    const document = await fetchRemoteDocument(data.url);

    return extractArticleFromHtml({
      html: document.body,
      url: document.finalUrl,
      itemId: data.itemId,
    });
  });

export const inspectArticleEmbed = createServerFn({ method: "POST" })
  .inputValidator(fetchArticleInputSchema)
  .handler(async (ctx): Promise<ArticleEmbedStatus> => {
    const { data } = ctx;
    const request = (ctx as { request?: Request }).request;
    const appOrigin = request ? new URL(request.url).origin : undefined;
    const headResponse = await fetchRemoteResponse(data.url, "HEAD");
    const response =
      !headResponse.ok || !hasEmbedPolicyHeaders(headResponse.headers)
        ? await fetchRemoteResponse(data.url, "GET")
        : headResponse;

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const finalUrl = response.url || data.url;
    const embedStatus = inspectEmbedHeaders({
      headers: response.headers,
      appOrigin,
      articleUrl: finalUrl,
    });

    return {
      itemId: data.itemId,
      url: data.url,
      finalUrl,
      ...embedStatus,
    };
  });
