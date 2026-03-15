import { z } from "zod";

const legacySourceKindSchema = z.enum(["feed", "scrape"]);

export const articleViewModeSchema = z.enum(["site", "reader"]);

export const savedSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  inputUrl: z.string().min(1),
  siteUrl: z.string().url(),
  feedUrl: z.string().url(),
  pollingEnabled: z.boolean(),
  pollIntervalMs: z.number().int().positive(),
  lastCheckedAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
});

export const storedFeedItemSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  contentHtml: z.string().optional(),
  contentText: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  author: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const feedItemSchema = storedFeedItemSchema.extend({
  isNew: z.boolean(),
  isRead: z.boolean(),
});

export const sourcePaginationSchema = z.object({
  loadedPageUrls: z.array(z.string().url()),
  nextPageUrl: z.string().url().optional(),
});

export const fetchedFeedSourceSchema = z.object({
  sourceId: z.string().min(1),
  label: z.string().min(1),
  siteUrl: z.string().url(),
  feedUrl: z.string().url(),
  items: z.array(storedFeedItemSchema),
  nextPageUrl: z.string().url().optional(),
});

export const discoveryResultSchema = z.object({
  source: savedSourceSchema,
  items: z.array(storedFeedItemSchema),
  checkedAt: z.string().datetime(),
  nextPageUrl: z.string().url().optional(),
});

export const refreshResultSchema = z.object({
  sourceId: z.string().min(1),
  items: z.array(storedFeedItemSchema),
  newCount: z.number().int().nonnegative(),
  checkedAt: z.string().datetime(),
  nextPageUrl: z.string().url().optional(),
});

export const loadMoreSourceItemsResultSchema = z.object({
  sourceId: z.string().min(1),
  pageUrl: z.string().url(),
  items: z.array(storedFeedItemSchema),
  nextPageUrl: z.string().url().optional(),
});

export const feedReaderStateV1Schema = z.object({
  version: z.literal(1),
  sources: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      inputUrl: z.string().min(1),
      siteUrl: z.string().url(),
      feedUrl: z.string().url().optional(),
      kind: legacySourceKindSchema,
      pollingEnabled: z.boolean(),
      pollIntervalMs: z.number().int().positive(),
      lastCheckedAt: z.string().datetime().optional(),
      lastError: z.string().optional(),
    }),
  ),
  itemsBySource: z.record(
    z.string(),
    z.array(
      z.object({
        id: z.string().min(1),
        sourceId: z.string().min(1),
        url: z.string().url(),
        title: z.string().min(1),
        excerpt: z.string().optional(),
        publishedAt: z.string().datetime().optional(),
        author: z.string().optional(),
        imageUrl: z.string().url().optional(),
      }),
    ),
  ),
  readItemIds: z.array(z.string()),
  seenItemIdsBySource: z.record(z.string(), z.array(z.string())),
  selectedSourceId: z.string().nullable(),
});

export const feedReaderStateV2Schema = feedReaderStateV1Schema.extend({
  version: z.literal(2),
  paginationBySource: z.record(z.string(), sourcePaginationSchema),
});

export const feedReaderStateSchema = z.object({
  version: z.literal(3),
  sources: z.array(savedSourceSchema),
  itemsBySource: z.record(z.string(), z.array(storedFeedItemSchema)),
  readItemIds: z.array(z.string()),
  seenItemIdsBySource: z.record(z.string(), z.array(z.string())),
  selectedSourceId: z.string().nullable(),
  paginationBySource: z.record(z.string(), sourcePaginationSchema),
});

export const fetchFeedSourceInputSchema = z.object({
  url: z.string().url(),
  sourceId: z.string().min(1).optional(),
  pollIntervalMs: z.number().int().positive().optional(),
});

export const refreshFeedSourceInputSchema = z.object({
  source: savedSourceSchema,
  seenItemIds: z.array(z.string()),
});

export const loadMoreSourceItemsInputSchema = z.object({
  source: savedSourceSchema,
  pageUrl: z.string().url(),
});

export const POLL_INTERVAL_MS = 15 * 60_000;
export const FEED_READER_STATE_VERSION = 3;
export const FEED_READER_STATE_STORAGE_KEY = "papertrail.feed-reader.state";
export const FEED_READER_PANEL_OPEN_STORAGE_KEY = "papertrail.feed-reader.panel-open";

export type ArticleViewMode = z.infer<typeof articleViewModeSchema>;
export type SavedSource = z.infer<typeof savedSourceSchema>;
export type StoredFeedItem = z.infer<typeof storedFeedItemSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type SourcePagination = z.infer<typeof sourcePaginationSchema>;
export type FetchedFeedSource = z.infer<typeof fetchedFeedSourceSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
export type RefreshResult = z.infer<typeof refreshResultSchema>;
export type LoadMoreSourceItemsResult = z.infer<typeof loadMoreSourceItemsResultSchema>;
export type FeedReaderStateV1 = z.infer<typeof feedReaderStateV1Schema>;
export type FeedReaderStateV2 = z.infer<typeof feedReaderStateV2Schema>;
export type FeedReaderState = z.infer<typeof feedReaderStateSchema>;
export type LoadMoreSourceItemsInput = z.infer<typeof loadMoreSourceItemsInputSchema>;
