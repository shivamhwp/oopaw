import type { StoredFeedItem } from "@/lib/types";

export const createStableHash = (value: string) => {
  let hash = 5381;

  for (const character of value) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }

  return Math.abs(hash >>> 0).toString(36);
};

export const normalizeInputUrl = (input: string) => {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Paste a direct RSS or Atom feed URL.");
  }

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  url.hash = "";

  return url.toString();
};

export const resolveUrl = (value: string | undefined, baseUrl: string) => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
};

export const normalizeOptionalDate = (value: string | number | Date | undefined | null) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

export const stripHtml = (value: string | undefined) =>
  value
    ?.replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const createExcerpt = (value: string | undefined, maxLength = 180) => {
  const plainText = stripHtml(value);

  if (!plainText) {
    return undefined;
  }

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength - 1).trimEnd()}...`;
};

const getTimestamp = (value: string | undefined) => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const sortItemsNewestFirst = <
  T extends Pick<StoredFeedItem, "publishedAt" | "title" | "id">,
>(
  items: T[],
) =>
  [...items].sort((left, right) => {
    const timeDelta = getTimestamp(right.publishedAt) - getTimestamp(left.publishedAt);

    if (timeDelta !== 0) {
      return timeDelta;
    }

    const titleDelta = left.title.localeCompare(right.title);

    if (titleDelta !== 0) {
      return titleDelta;
    }

    return left.id.localeCompare(right.id);
  });

export const dedupeItems = (items: StoredFeedItem[]) => {
  const deduped = new Map<string, StoredFeedItem>();

  for (const item of sortItemsNewestFirst(items)) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }

  return [...deduped.values()];
};

export const createSourceId = (canonicalUrl: string) => `source_${createStableHash(canonicalUrl)}`;

export const createFeedItemId = (sourceId: string, values: Array<string | undefined>) => {
  const identity = values.filter(Boolean).join("::");

  return `item_${createStableHash(identity || sourceId)}`;
};

export const getHostnameLabel = (urlValue: string) => {
  const url = new URL(urlValue);

  return url.hostname.replace(/^www\./, "");
};

export const clampArray = <T>(items: T[], size: number) => items.slice(0, size);
