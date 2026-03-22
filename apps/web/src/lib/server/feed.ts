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

const FEED_NOT_SUPPORTED_ERROR =
  "Paste a direct RSS or Atom feed URL. Homepages and JSON feeds are not supported.";
const FEED_XML_UNSAFE_ERROR =
  "This feed uses XML DTD/entities that are not supported for safety reasons.";
const FEED_FETCH_TIMEOUT_MS = 12_000;

type FeedIngestionErrorCode =
  | "network_timeout"
  | "http_error"
  | "too_large"
  | "unsafe_xml"
  | "not_a_feed"
  | "unsupported_feed"
  | "parse_failed"
  | "network_error";

class FeedIngestionError extends Error {
  code: FeedIngestionErrorCode;
  status?: number;

  constructor(code: FeedIngestionErrorCode, message: string, options?: { status?: number }) {
    super(message);
    this.name = "FeedIngestionError";
    this.code = code;
    this.status = options?.status;
  }
}

type FeedDocument = {
  body: string;
  contentType: string;
  finalUrl: string;
};

const feedRequestHeaders = {
  accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.5",
};

const throwFeedError = (
  code: FeedIngestionErrorCode,
  message: string,
  options?: { status?: number },
): never => {
  throw new FeedIngestionError(code, message, options);
};

const inspectFeedDocument = (body: string) => {
  const trimmed = body.trimStart();
  const loweredPrefix = trimmed.slice(0, 4_096).toLowerCase();

  if (loweredPrefix.includes("<!doctype") || loweredPrefix.includes("<!entity")) {
    throwFeedError("unsafe_xml", FEED_XML_UNSAFE_ERROR);
  }
};

const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout),
  };
};

const readResponseBody = async (response: Response) => {
  if (!response.body) {
    return response.text();
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        body += decoder.decode();
        return body;
      }

      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};

const fetchRemoteDocument = async (url: string): Promise<FeedDocument> => {
  const { signal, dispose } = createTimeoutSignal(FEED_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: feedRequestHeaders,
      redirect: "follow",
      signal,
    });

    if (!response.ok) {
      throwFeedError("http_error", `The feed request failed with status ${response.status}.`, {
        status: response.status,
      });
    }

    return {
      body: await readResponseBody(response),
      finalUrl: response.url,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    if (error instanceof FeedIngestionError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new FeedIngestionError("network_timeout", "The feed took too long to respond.");
    }

    throw new FeedIngestionError(
      "network_error",
      error instanceof Error && error.message
        ? error.message
        : "The feed could not be reached right now.",
    );
  } finally {
    dispose();
  }
};

const validateFeedDocument = (document: FeedDocument) => {
  if (!looksLikeFeedDocument(document.contentType, document.body)) {
    throwFeedError("not_a_feed", FEED_NOT_SUPPORTED_ERROR);
  }

  inspectFeedDocument(document.body);
};

const parseFetchedFeedDocument = (document: FeedDocument, sourceId?: string) => {
  try {
    return parseFeedDocument({
      body: document.body,
      baseUrl: document.finalUrl,
      sourceId: sourceId ?? createSourceId(document.finalUrl),
    });
  } catch (error) {
    if (error instanceof FeedIngestionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "";

    if (message === FEED_NOT_SUPPORTED_ERROR) {
      throw new FeedIngestionError("unsupported_feed", FEED_NOT_SUPPORTED_ERROR);
    }

    throw new FeedIngestionError("parse_failed", "This feed could not be parsed.");
  }
};

const normalizeFeedSource = async (document: FeedDocument, sourceId?: string) => {
  const parsed = parseFetchedFeedDocument(document, sourceId);

  return fetchedFeedSourceSchema.parse({
    ...parsed,
    items: await sanitizeFeedItems(parsed.items),
  });
};

const loadFeedSource = async ({ url, sourceId }: { url: string; sourceId?: string }) => {
  const document = await fetchRemoteDocument(url);
  validateFeedDocument(document);
  return normalizeFeedSource(document, sourceId);
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
