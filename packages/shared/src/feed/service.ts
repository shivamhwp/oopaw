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

const feedRequestHeaders: HeadersInit = {
  accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.5",
  "User-Agent": "Mozilla/5.0 (compatible; FeedReader/1.0; +https://github.com/feed-reader)",
};

const MAX_REMOTE_DOCUMENT_BYTES = 1_500_000;
const blockedHostnames = new Set(["localhost", "metadata", "metadata.google.internal"]);
const blockedHostnameSuffixes = [".internal", ".local", ".localhost"];

const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout),
  };
};

const normalizeIpLiteral = (hostname: string) => {
  const normalizedHostname = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;

  if (normalizedHostname.startsWith("[") && normalizedHostname.endsWith("]")) {
    return normalizedHostname.slice(1, -1);
  }

  return normalizedHostname;
};

const isIpv4Address = (value: string) => {
  const parts = value.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
};

const isBlockedIpv4Address = (value: string) => {
  if (!isIpv4Address(value)) {
    return false;
  }

  const parts = value.split(".");
  const first = Number(parts[0] ?? "0");
  const second = Number(parts[1] ?? "0");

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
};

const isHexGroup = (value: string) => /^[\da-f]{1,4}$/i.test(value);

const isIpv6Address = (value: string) => {
  if (!value.includes(":")) {
    return false;
  }

  const [head = "", tail] = value.split("::");

  if (tail !== undefined && value.indexOf("::") !== value.lastIndexOf("::")) {
    return false;
  }

  const parseGroups = (segment: string, allowIpv4Tail: boolean) =>
    segment === ""
      ? []
      : segment.split(":").map((part, index, parts) => {
          if (allowIpv4Tail && index === parts.length - 1 && isIpv4Address(part)) {
            return "ipv4";
          }

          return isHexGroup(part) ? "hex" : "invalid";
        });

  const headGroups = parseGroups(head, tail === undefined);
  const tailGroups = tail === undefined ? [] : parseGroups(tail, true);

  if ([...headGroups, ...tailGroups].includes("invalid")) {
    return false;
  }

  const groupCount = [...headGroups, ...tailGroups].reduce(
    (count, group) => count + (group === "ipv4" ? 2 : 1),
    0,
  );

  return tail === undefined ? groupCount === 8 : groupCount < 8;
};

const expandIpv6Address = (value: string) => {
  if (!isIpv6Address(value)) {
    return null;
  }

  const [head = "", tail] = value.split("::");
  const parseSegment = (segment: string) =>
    segment === ""
      ? []
      : segment.split(":").flatMap((part) => {
          if (isIpv4Address(part)) {
            const [a = 0, b = 0, c = 0, d = 0] = part.split(".").map(Number);
            return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
          }

          return [part];
        });

  const headGroups = parseSegment(head);
  const tailGroups = tail === undefined ? [] : parseSegment(tail);
  const missingGroups = 8 - (headGroups.length + tailGroups.length);

  if (missingGroups < 0) {
    return null;
  }

  return [...headGroups, ...Array.from({ length: missingGroups }, () => "0"), ...tailGroups].map(
    (group) => group.padStart(4, "0"),
  );
};

const isBlockedIpv6Address = (value: string) => {
  const groups = expandIpv6Address(value);

  if (!groups) {
    return false;
  }

  if (
    groups.slice(0, 5).every((group) => group === "0000") &&
    (groups[5] ?? "").toLowerCase() === "ffff"
  ) {
    const [seventh = 0, eighth = 0] = groups.slice(6).map((group) => Number.parseInt(group, 16));
    const mappedIpv4 = [
      (seventh >> 8) & 0xff,
      seventh & 0xff,
      (eighth >> 8) & 0xff,
      eighth & 0xff,
    ].join(".");

    return isBlockedIpv4Address(mappedIpv4);
  }

  const firstGroup = Number.parseInt(groups[0] ?? "0", 16);

  return (
    groups.every((group) => group === "0000") ||
    groups.join(":") === "0000:0000:0000:0000:0000:0000:0000:0001" ||
    (firstGroup & 0xfe00) === 0xfc00 ||
    (firstGroup & 0xffc0) === 0xfe80
  );
};

const assertAllowedRemoteUrl = (rawUrl: string) => {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("The feed URL is invalid.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("The feed URL must use HTTP or HTTPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("The feed URL cannot include credentials.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const normalizedHost = normalizeIpLiteral(hostname);

  if (
    blockedHostnames.has(normalizedHost) ||
    blockedHostnameSuffixes.some((suffix) => normalizedHost.endsWith(suffix)) ||
    isBlockedIpv4Address(normalizedHost) ||
    isBlockedIpv6Address(normalizedHost)
  ) {
    throw new Error("The feed URL points to a disallowed host.");
  }

  return parsed.toString();
};

const readResponseBody = async ({
  response,
  controller,
  maxBytes,
}: {
  response: Response;
  controller: AbortController;
  maxBytes: number;
}) => {
  const contentLength = response.headers.get("content-length");

  if (contentLength) {
    const declaredSize = Number(contentLength);

    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      controller.abort();
      throw new Error("The feed document is too large.");
    }
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        controller.abort();
        throw new Error("The feed document is too large.");
      }

      body += decoder.decode(value, { stream: true });
    }

    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
};

const fetchRemoteDocument = async (url: string) => {
  assertAllowedRemoteUrl(url);

  const { signal: timeoutSignal, dispose } = createTimeoutSignal(12_000);
  const controller = new AbortController();
  const abortOnTimeout = () => controller.abort();

  timeoutSignal.addEventListener("abort", abortOnTimeout);

  try {
    const response = await fetch(url, {
      headers: feedRequestHeaders,
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = assertAllowedRemoteUrl(response.url);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    return {
      body: await readResponseBody({
        response,
        controller,
        maxBytes: MAX_REMOTE_DOCUMENT_BYTES,
      }),
      finalUrl,
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
    timeoutSignal.removeEventListener("abort", abortOnTimeout);
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
