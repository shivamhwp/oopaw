import { createServerFn } from "@tanstack/react-start";
import {
  discoveryResultSchema,
  fetchFeedSourceInputSchema,
  fetchedFeedSourceSchema,
  loadMoreSourceItemsInputSchema,
  loadMoreSourceItemsResultSchema,
  POLL_INTERVAL_MS,
  refreshFeedSourceInputSchema,
  refreshResultSchema,
} from "@/lib/types";
import { sanitizeFeedItems } from "@/lib/feed/content";
import { looksLikeFeedDocument, parseFeedDocument } from "@/lib/feed/parser";
import { createSourceId } from "@/lib/feed/utils";

const FEED_INPUT_ERROR =
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
    items: await sanitizeFeedItems(parsed.items),
  });
};

const fetchFeedSourceResult = async (data: {
  url: string;
  sourceId?: string;
  pollIntervalMs?: number;
}) => {
  const loaded = await loadFeedSource(data);
  const checkedAt = new Date().toISOString();

  return discoveryResultSchema.parse({
    source: {
      id: loaded.sourceId,
      label: loaded.label,
      inputUrl: data.url,
      siteUrl: loaded.siteUrl,
      feedUrl: loaded.feedUrl,
      pollingEnabled: true,
      pollIntervalMs: data.pollIntervalMs ?? POLL_INTERVAL_MS,
      lastCheckedAt: checkedAt,
    },
    items: loaded.items,
    checkedAt,
    nextPageUrl: loaded.nextPageUrl,
  });
};

const refreshFeedSourceResult = async (data: {
  source: { id: string; feedUrl: string };
  seenItemIds: string[];
}) => {
  const loaded = await loadFeedSource({
    url: data.source.feedUrl,
    sourceId: data.source.id,
  });
  const checkedAt = new Date().toISOString();
  const seenIds = new Set(data.seenItemIds);

  return refreshResultSchema.parse({
    sourceId: data.source.id,
    items: loaded.items,
    newCount: loaded.items.filter((item) => !seenIds.has(item.id)).length,
    checkedAt,
    nextPageUrl: loaded.nextPageUrl,
  });
};

const loadMoreFeedItemsResult = async (data: { source: { id: string }; pageUrl: string }) => {
  const loaded = await loadFeedSource({
    url: data.pageUrl,
    sourceId: data.source.id,
  });

  return loadMoreSourceItemsResultSchema.parse({
    sourceId: data.source.id,
    pageUrl: data.pageUrl,
    items: loaded.items,
    nextPageUrl: loaded.nextPageUrl,
  });
};

export const fetchFeedSource = createServerFn({ method: "POST" })
  .inputValidator(fetchFeedSourceInputSchema)
  .handler(async ({ data }) => fetchFeedSourceResult(data));

export const refreshFeedSource = createServerFn({ method: "POST" })
  .inputValidator(refreshFeedSourceInputSchema)
  .handler(async ({ data }) => refreshFeedSourceResult(data));

export const loadMoreFeedItems = createServerFn({ method: "POST" })
  .inputValidator(loadMoreSourceItemsInputSchema)
  .handler(async ({ data }) => loadMoreFeedItemsResult(data));
