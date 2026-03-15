import { z } from "zod";

const legacySourceKindSchema = z.enum(["feed", "scrape"]);

export const articleViewModeSchema = z.enum(["site", "reader"]);

export const discoveredFeedSubscriptionSchema = z.object({
  sourceId: z.string().min(1),
  inputUrl: z.string().min(1),
  label: z.string().min(1),
  siteUrl: z.string().url(),
  feedUrl: z.string().url(),
});

export const feedSubscriptionSchema = discoveredFeedSubscriptionSchema.extend({
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
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
  source: discoveredFeedSubscriptionSchema,
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

export const localFeedCacheSourceStateSchema = z.object({
  items: z.array(storedFeedItemSchema),
  readItemIds: z.array(z.string()),
  seenItemIds: z.array(z.string()),
  pagination: sourcePaginationSchema.optional(),
  lastCheckedAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
});

export const localFeedCacheSchema = z.object({
  version: z.literal(1),
  sources: z.record(z.string(), localFeedCacheSourceStateSchema),
  selectedSourceId: z.string().nullable(),
});

export const localFeedCacheStorageSchema = z.object({
  version: z.literal(1),
  users: z.record(z.string(), localFeedCacheSchema),
});

export const legacySavedSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  inputUrl: z.string().min(1),
  siteUrl: z.string().url(),
  feedUrl: z.string().url().optional(),
  kind: legacySourceKindSchema.optional(),
  pollingEnabled: z.boolean(),
  pollIntervalMs: z.number().int().positive(),
  lastCheckedAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
});

export const legacyFeedReaderStateV1Schema = z.object({
  version: z.literal(1),
  sources: z.array(legacySavedSourceSchema),
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

export const legacyFeedReaderStateV2Schema = legacyFeedReaderStateV1Schema.extend({
  version: z.literal(2),
  paginationBySource: z.record(z.string(), sourcePaginationSchema),
});

export const legacyFeedReaderStateV3Schema = z.object({
  version: z.literal(3),
  sources: z.array(
    legacySavedSourceSchema.extend({
      feedUrl: z.string().url(),
    }),
  ),
  itemsBySource: z.record(z.string(), z.array(storedFeedItemSchema)),
  readItemIds: z.array(z.string()),
  seenItemIdsBySource: z.record(z.string(), z.array(z.string())),
  selectedSourceId: z.string().nullable(),
  paginationBySource: z.record(z.string(), sourcePaginationSchema),
});

export const fetchFeedSourceInputSchema = z.object({
  url: z.string().url(),
  sourceId: z.string().min(1).optional(),
});

export const refreshFeedSourceInputSchema = z.object({
  source: z.object({
    sourceId: z.string().min(1),
    feedUrl: z.string().url(),
  }),
  seenItemIds: z.array(z.string()),
});

export const loadMoreSourceItemsInputSchema = z.object({
  sourceId: z.string().min(1),
  pageUrl: z.string().url(),
});

export const POLL_INTERVAL_MS = 15 * 60_000;
export const LOCAL_FEED_CACHE_VERSION = 1;
export const LOCAL_FEED_CACHE_STORAGE_VERSION = 1;
export const LEGACY_FEED_READER_STATE_STORAGE_KEY = "papertrail.feed-reader.state";
export const LOCAL_FEED_CACHE_STORAGE_KEY = "papertrail.feed-reader.cache";
export const FEED_READER_PANEL_OPEN_STORAGE_KEY = "papertrail.feed-reader.panel-open";

export type ArticleViewMode = z.infer<typeof articleViewModeSchema>;
export type DiscoveredFeedSubscription = z.infer<typeof discoveredFeedSubscriptionSchema>;
export type FeedSubscription = z.infer<typeof feedSubscriptionSchema>;
export type StoredFeedItem = z.infer<typeof storedFeedItemSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type SourcePagination = z.infer<typeof sourcePaginationSchema>;
export type FetchedFeedSource = z.infer<typeof fetchedFeedSourceSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
export type RefreshResult = z.infer<typeof refreshResultSchema>;
export type LoadMoreSourceItemsResult = z.infer<typeof loadMoreSourceItemsResultSchema>;
export type LocalFeedCacheSourceState = z.infer<typeof localFeedCacheSourceStateSchema>;
export type LocalFeedCache = z.infer<typeof localFeedCacheSchema>;
export type LocalFeedCacheStorage = z.infer<typeof localFeedCacheStorageSchema>;
export type LegacySavedSource = z.infer<typeof legacySavedSourceSchema>;
export type LegacyFeedReaderStateV1 = z.infer<typeof legacyFeedReaderStateV1Schema>;
export type LegacyFeedReaderStateV2 = z.infer<typeof legacyFeedReaderStateV2Schema>;
export type LegacyFeedReaderStateV3 = z.infer<typeof legacyFeedReaderStateV3Schema>;
export type LoadMoreSourceItemsInput = z.infer<typeof loadMoreSourceItemsInputSchema>;
