import {
  discoveryResultSchema,
  fetchedFeedSourceSchema,
  loadMoreSourceItemsResultSchema,
  refreshResultSchema,
  type DiscoveryResult,
  type DiscoveredFeedSubscription,
  type LoadMoreSourceItemsResult,
  type RefreshResult,
} from "./types";
import { sanitizeFeedItems } from "./content";
import { looksLikeFeedDocument, parseFeedDocument } from "./parser";
import { createSourceId } from "./utils";

export const FEED_INPUT_ERROR =
  "Paste a direct RSS or Atom feed URL. Homepages and JSON feeds are not supported.";

const feedRequestHeaders = {
  accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.5",
};

const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout),
  };
};

const fetchRemoteDocument = async (url: string) => {
  const { signal, dispose } = createTimeoutSignal(12_000);

  try {
    const response = await fetch(url, {
      headers: feedRequestHeaders,
      redirect: "follow",
      signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    return {
      body: await response.text(),
      finalUrl: response.url,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The feed took too long to respond."
        : error instanceof Error && error.message
          ? error.message
          : "The feed could not be reached right now.";

    throw new Error(message);
  } finally {
    dispose();
  }
};

const loadFeedSource = async ({ url, sourceId }: { url: string; sourceId?: string }) => {
  const document = await fetchRemoteDocument(url);

  if (!looksLikeFeedDocument(document.contentType, document.body)) {
    throw new Error(FEED_INPUT_ERROR);
  }

  const parsed = parseFeedDocument({
    body: document.body,
    baseUrl: document.finalUrl,
    sourceId: sourceId ?? createSourceId(document.finalUrl),
  });

  return fetchedFeedSourceSchema.parse({
    ...parsed,
    items: sanitizeFeedItems(parsed.items),
  });
};

export const discoverFeed = async (inputUrl: string): Promise<DiscoveryResult> => {
  const loaded = await loadFeedSource({ url: inputUrl });
  const checkedAt = new Date().toISOString();

  return discoveryResultSchema.parse({
    source: {
      sourceId: loaded.sourceId,
      inputUrl,
      label: loaded.label,
      siteUrl: loaded.siteUrl,
      feedUrl: loaded.feedUrl,
    } satisfies DiscoveredFeedSubscription,
    items: loaded.items,
    checkedAt,
    nextPageUrl: loaded.nextPageUrl,
  });
};

export const refreshDiscoveredFeed = async (data: {
  source: Pick<DiscoveredFeedSubscription, "sourceId" | "feedUrl">;
  seenItemIds: string[];
}): Promise<RefreshResult> => {
  const loaded = await loadFeedSource({
    url: data.source.feedUrl,
    sourceId: data.source.sourceId,
  });
  const checkedAt = new Date().toISOString();
  const seenIds = new Set(data.seenItemIds);

  return refreshResultSchema.parse({
    sourceId: data.source.sourceId,
    items: loaded.items,
    newCount: loaded.items.filter((item) => !seenIds.has(item.id)).length,
    checkedAt,
    nextPageUrl: loaded.nextPageUrl,
  });
};

export const loadMoreDiscoveredFeedItems = async (data: {
  sourceId: string;
  pageUrl: string;
}): Promise<LoadMoreSourceItemsResult> => {
  const loaded = await loadFeedSource({
    url: data.pageUrl,
    sourceId: data.sourceId,
  });

  return loadMoreSourceItemsResultSchema.parse({
    sourceId: data.sourceId,
    pageUrl: data.pageUrl,
    items: loaded.items,
    nextPageUrl: loaded.nextPageUrl,
  });
};
