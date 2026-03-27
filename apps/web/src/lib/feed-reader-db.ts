import Dexie, { type Table } from "dexie";
import { dedupeItems, sortItemsNewestFirst } from "@/lib/feed/utils";
import type { StoredFeedItem } from "@/lib/types";

export const SOURCE_STALE_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_CACHED_ITEMS_PER_SOURCE = 250;

type SourceItemRecord = StoredFeedItem & {
  updatedAt: number;
};

export type SourceMetaRecord = {
  sourceId: string;
  lastFetchedAt: number;
  lastCheckedAt?: string;
  nextPageUrl?: string;
  loadedPageUrls: string[];
  lastError?: string;
};

type FeedItemStateRecord = {
  sourceId: string;
  itemId: string;
  read: boolean;
  seen: boolean;
  updatedAt: number;
};

type ReaderArticleRecord = {
  itemId: string;
  updatedAt: number;
  contentHtml?: string;
  contentText?: string;
  excerpt?: string;
  author?: string;
  imageUrl?: string;
  publishedAt?: string;
  title: string;
};

class FeedReaderDatabase extends Dexie {
  sourceItems!: Table<SourceItemRecord, [string, string]>;
  sourceMeta!: Table<SourceMetaRecord, string>;
  feedItemState!: Table<FeedItemStateRecord, [string, string]>;
  readerArticles!: Table<ReaderArticleRecord, string>;

  constructor() {
    super("papertrail-feed-reader");

    this.version(1).stores({
      sourceItems: "[sourceId+id], sourceId, publishedAt, updatedAt",
      sourceMeta: "sourceId, lastFetchedAt",
      feedItemState: "[sourceId+itemId], sourceId, updatedAt",
      readerArticles: "itemId, updatedAt",
    });
  }
}

const database = new FeedReaderDatabase();

const canUseIndexedDb = () => typeof window !== "undefined" && "indexedDB" in window;

const groupBySourceId = <Value extends { sourceId: string }>(values: Value[]) => {
  const groups: Record<string, Value[]> = {};

  for (const value of values) {
    groups[value.sourceId] = [...(groups[value.sourceId] ?? []), value];
  }

  return groups;
};

const withDbFallback = async <Value>(load: () => Promise<Value>, fallback: Value) => {
  if (!canUseIndexedDb()) {
    return fallback;
  }

  try {
    return await load();
  } catch (error) {
    console.warn("Feed reader cache is unavailable.", error);
    return fallback;
  }
};

export const getCachedSourceItems = async (sourceId: string) =>
  withDbFallback(
    async () =>
      sortItemsNewestFirst(
        dedupeItems(await database.sourceItems.where("sourceId").equals(sourceId).toArray()),
      ),
    [] as StoredFeedItem[],
  );

export const upsertSourceItems = async (sourceId: string, items: StoredFeedItem[]) =>
  withDbFallback(async () => {
    await database.transaction("rw", database.sourceItems, database.feedItemState, async () => {
      const updatedAt = Date.now();

      await database.sourceItems.bulkPut(items.map((item) => ({ ...item, sourceId, updatedAt })));

      const allSourceItems = sortItemsNewestFirst(
        dedupeItems(await database.sourceItems.where("sourceId").equals(sourceId).toArray()),
      );
      const itemsToRemove = allSourceItems.slice(MAX_CACHED_ITEMS_PER_SOURCE);

      if (itemsToRemove.length === 0) {
        return;
      }

      await Promise.all([
        database.sourceItems.bulkDelete(
          itemsToRemove.map((item) => [sourceId, item.id] as [string, string]),
        ),
        database.feedItemState.bulkDelete(
          itemsToRemove.map((item) => [sourceId, item.id] as [string, string]),
        ),
      ]);
    });
  }, undefined);

export const getSourceMeta = async (sourceId: string) =>
  withDbFallback(
    async () => database.sourceMeta.get(sourceId),
    undefined as SourceMetaRecord | undefined,
  );

export const upsertSourceMeta = async (meta: SourceMetaRecord) =>
  withDbFallback(async () => database.sourceMeta.put(meta), undefined);

export const shouldRefreshSource = async (sourceId: string, ttlMs: number, now = Date.now()) =>
  withDbFallback(async () => {
    const [meta, itemCount] = await Promise.all([
      database.sourceMeta.get(sourceId),
      database.sourceItems.where("sourceId").equals(sourceId).count(),
    ]);

    return !meta || itemCount === 0 || now - meta.lastFetchedAt > ttlMs;
  }, true);

export const markItemRead = async (sourceId: string, itemId: string) =>
  withDbFallback(
    async () =>
      database.feedItemState.put({
        sourceId,
        itemId,
        read: true,
        seen: true,
        updatedAt: Date.now(),
      }),
    undefined,
  );

export const markItemUnread = async (sourceId: string, itemId: string) =>
  withDbFallback(async () => {
    const existing = await database.feedItemState.get([sourceId, itemId]);

    await database.feedItemState.put({
      sourceId,
      itemId,
      read: false,
      seen: existing?.seen ?? true,
      updatedAt: Date.now(),
    });
  }, undefined);

export const markItemsSeen = async (sourceId: string, itemIds: string[]) =>
  withDbFallback(async () => {
    if (itemIds.length === 0) {
      return;
    }

    const existing = await database.feedItemState.bulkGet(
      itemIds.map((itemId) => [sourceId, itemId]),
    );
    const updatedAt = Date.now();

    await database.feedItemState.bulkPut(
      itemIds.map((itemId, index) => ({
        sourceId,
        itemId,
        read: existing[index]?.read ?? false,
        seen: true,
        updatedAt,
      })),
    );
  }, undefined);

export const getItemStateMap = async (sourceId: string) =>
  withDbFallback(
    async () =>
      Object.fromEntries(
        (await database.feedItemState.where("sourceId").equals(sourceId).toArray()).map((entry) => [
          entry.itemId,
          { isRead: entry.read, isSeen: entry.seen },
        ]),
      ),
    {} as Record<string, { isRead: boolean; isSeen: boolean }>,
  );

export const getCachedFeedReaderData = async (sourceIds: string[]) =>
  withDbFallback(
    async () => {
      if (sourceIds.length === 0) {
        return {
          itemStateBySource: {} as Record<
            string,
            Record<string, { isRead: boolean; isSeen: boolean }>
          >,
          itemsBySource: {} as Record<string, StoredFeedItem[]>,
          metaBySource: {} as Record<string, SourceMetaRecord>,
        };
      }

      const [items, metaEntries, itemStateEntries] = await Promise.all([
        database.sourceItems.where("sourceId").anyOf(sourceIds).toArray(),
        database.sourceMeta.bulkGet(sourceIds),
        database.feedItemState.where("sourceId").anyOf(sourceIds).toArray(),
      ]);
      const itemStateGroups = groupBySourceId(itemStateEntries);
      const itemGroups = groupBySourceId(items);

      return {
        itemStateBySource: itemStateGroups,
        itemsBySource: Object.fromEntries(
          Object.entries(itemGroups).map(([sourceId, sourceItems]) => [
            sourceId,
            sortItemsNewestFirst(dedupeItems(sourceItems)),
          ]),
        ) as Record<string, StoredFeedItem[]>,
        metaBySource: Object.fromEntries(
          metaEntries
            .filter((entry): entry is SourceMetaRecord => Boolean(entry))
            .map((entry) => [entry.sourceId, entry]),
        ) as Record<string, SourceMetaRecord>,
      };
    },
    {
      itemStateBySource: {} as Record<string, FeedItemStateRecord[]>,
      itemsBySource: {} as Record<string, StoredFeedItem[]>,
      metaBySource: {} as Record<string, SourceMetaRecord>,
    },
  ).then(({ itemStateBySource, itemsBySource, metaBySource }) => ({
    itemsBySource,
    metaBySource,
    itemStateBySource: Object.fromEntries(
      Object.entries(itemStateBySource).map(([sourceId, entries]) => [
        sourceId,
        Object.fromEntries(
          entries.map((entry: FeedItemStateRecord) => [
            entry.itemId,
            { isRead: entry.read, isSeen: entry.seen },
          ]),
        ),
      ]),
    ) as Record<string, Record<string, { isRead: boolean; isSeen: boolean }>>,
  }));

export const pruneRemovedSources = async (validSourceIds: string[]) =>
  withDbFallback(async () => {
    const validSourceIdSet = new Set(validSourceIds);
    const [sourceMetaEntries, sourceItemEntries, itemStateEntries] = await Promise.all([
      database.sourceMeta.toArray(),
      database.sourceItems.toArray(),
      database.feedItemState.toArray(),
    ]);

    await Promise.all([
      database.sourceMeta.bulkDelete(
        sourceMetaEntries
          .filter((entry) => !validSourceIdSet.has(entry.sourceId))
          .map((entry) => entry.sourceId),
      ),
      database.sourceItems.bulkDelete(
        sourceItemEntries
          .filter((entry) => !validSourceIdSet.has(entry.sourceId))
          .map((entry) => [entry.sourceId, entry.id] as [string, string]),
      ),
      database.feedItemState.bulkDelete(
        itemStateEntries
          .filter((entry) => !validSourceIdSet.has(entry.sourceId))
          .map((entry) => [entry.sourceId, entry.itemId] as [string, string]),
      ),
    ]);
  }, undefined);
