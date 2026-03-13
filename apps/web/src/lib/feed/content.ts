import sanitizeHtml from "sanitize-html";
import type { StoredFeedItem } from "@/lib/types";

const trimSanitizedHtml = (value: string) => {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
};

const mergeValues = <Value>(values: readonly Value[], extras: readonly Value[]) => [
  ...new Set([...values, ...extras]),
];

const sanitizeFeedHtmlOptions = {
  allowedTags: mergeValues(sanitizeHtml.defaults.allowedTags, [
    "audio",
    "details",
    "img",
    "picture",
    "source",
    "summary",
    "track",
    "video",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["aria-*", "data-*", "dir", "lang", "title"],
    a: mergeValues(sanitizeHtml.defaults.allowedAttributes.a ?? [], ["hreflang", "rel", "title"]),
    audio: ["autoplay", "controls", "controlslist", "loop", "muted", "preload", "src"],
    blockquote: ["cite"],
    details: ["open"],
    img: mergeValues(sanitizeHtml.defaults.allowedAttributes.img ?? [], [
      "decoding",
      "fetchpriority",
      "sizes",
      "srcset",
    ]),
    q: ["cite"],
    source: ["media", "sizes", "src", "srcset", "type"],
    td: ["abbr", "colspan", "headers", "rowspan"],
    th: ["abbr", "colspan", "headers", "rowspan", "scope"],
    time: ["datetime"],
    track: ["default", "kind", "label", "src", "srclang"],
    video: [
      "autoplay",
      "controls",
      "controlslist",
      "height",
      "loop",
      "muted",
      "playsinline",
      "poster",
      "preload",
      "src",
      "width",
    ],
  },
  allowedSchemes: mergeValues(sanitizeHtml.defaults.allowedSchemes, ["data"]),
  allowedSchemesAppliedToAttributes: mergeValues(
    sanitizeHtml.defaults.allowedSchemesAppliedToAttributes,
    ["poster"],
  ),
  allowedSchemesByTag: {
    ...sanitizeHtml.defaults.allowedSchemesByTag,
    img: ["data", "http", "https"],
    source: ["data", "http", "https"],
    video: ["http", "https"],
  },
  transformTags: {
    a: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: attribs.href
        ? {
            ...attribs,
            rel: "noopener noreferrer",
            target: "_blank",
          }
        : attribs,
    }),
    img: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        decoding: attribs.decoding ?? "async",
        loading: attribs.loading ?? "lazy",
      },
    }),
  },
} satisfies NonNullable<Parameters<typeof sanitizeHtml>[1]>;

export const sanitizeFeedHtml = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  return trimSanitizedHtml(sanitizeHtml(value, sanitizeFeedHtmlOptions));
};

export const sanitizeFeedItems = (items: StoredFeedItem[]) =>
  items.map((item) => ({
    ...item,
    contentHtml: sanitizeFeedHtml(item.contentHtml),
  }));
