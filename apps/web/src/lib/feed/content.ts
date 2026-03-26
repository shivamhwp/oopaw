import sanitizeHtml from "sanitize-html";
import type { StoredFeedItem } from "@/lib/types";
import { resolveUrl } from "@/lib/feed/utils";

const trimSanitizedHtml = (value: string) => {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
};

const mergeValues = <Value>(values: readonly Value[], extras: readonly Value[]) => [
  ...new Set([...values, ...extras]),
];

const resolveAttributeUrl = (value: string, baseUrl: string | undefined) => {
  if (!baseUrl) {
    return value;
  }

  return resolveUrl(value, baseUrl) ?? value;
};

const resolveSrcSet = (value: string, baseUrl: string | undefined) => {
  if (!baseUrl) {
    return value;
  }

  return value
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();

      if (!trimmed) {
        return undefined;
      }

      const [url, ...descriptorParts] = trimmed.split(/\s+/);
      const resolved = resolveUrl(url, baseUrl) ?? url;
      const descriptor = descriptorParts.join(" ");

      return descriptor ? `${resolved} ${descriptor}` : resolved;
    })
    .filter(Boolean)
    .join(", ");
};

const resolveTagAttributes = (
  attribs: Record<string, string>,
  baseUrl: string | undefined,
  attributes: string[],
) => {
  const nextAttribs = { ...attribs };

  for (const attribute of attributes) {
    const value = nextAttribs[attribute];

    if (!value) {
      continue;
    }

    nextAttribs[attribute] =
      attribute === "srcset" ? resolveSrcSet(value, baseUrl) : resolveAttributeUrl(value, baseUrl);
  }

  return nextAttribs;
};

const createSanitizeHtmlOptions = (baseUrl: string | undefined) =>
  ({
    allowedTags: mergeValues(sanitizeHtml.defaults.allowedTags, [
      // Media
      "audio",
      "img",
      "picture",
      "source",
      "track",
      "video",
      // Semantic blocks
      "article",
      "aside",
      "details",
      "figcaption",
      "figure",
      "footer",
      "header",
      "hgroup",
      "main",
      "mark",
      "section",
      "summary",
      // Inline semantics commonly used in blogs
      "abbr",
      "cite",
      "data",
      "del",
      "dfn",
      "ins",
      "kbd",
      "ruby",
      "rp",
      "rt",
      "samp",
      "sub",
      "sup",
      "var",
      "wbr",
      // Definition lists (docs / tech blogs)
      "dl",
      "dt",
      "dd",
      // Embedded content
      "iframe",
      // Other
      "hr",
      "time",
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
      del: ["cite", "datetime"],
      figure: [],
      figcaption: [],
      iframe: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "height",
        "loading",
        "referrerpolicy",
        "sandbox",
        "src",
        "title",
        "width",
      ],
      ins: ["cite", "datetime"],
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
      iframe: ["https"],
      img: ["data", "http", "https"],
      source: ["data", "http", "https"],
      video: ["http", "https"],
    },
    allowedIframeHostnames: [
      // Video
      "www.youtube.com",
      "www.youtube-nocookie.com",
      "player.vimeo.com",
      // Code
      "codepen.io",
      "codesandbox.io",
      "stackblitz.com",
      "jsfiddle.net",
      // Social / embeds
      "open.spotify.com",
      "bandcamp.com",
      "w.soundcloud.com",
      "embed.podcasts.apple.com",
      // Misc
      "www.google.com",
      "docs.google.com",
      "gist.github.com",
    ],
    transformTags: {
      a: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: attribs.href
          ? {
              ...resolveTagAttributes(attribs, baseUrl, ["href"]),
              rel: "noopener noreferrer",
              target: "_blank",
            }
          : attribs,
      }),
      audio: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: resolveTagAttributes(attribs, baseUrl, ["src"]),
      }),
      blockquote: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: resolveTagAttributes(attribs, baseUrl, ["cite"]),
      }),
      iframe: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: {
          ...resolveTagAttributes(attribs, baseUrl, ["src"]),
          loading: "lazy",
          referrerpolicy: "no-referrer",
          sandbox: "allow-scripts allow-same-origin allow-popups",
        },
      }),
      img: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: {
          ...resolveTagAttributes(attribs, baseUrl, ["src", "srcset"]),
          decoding: attribs.decoding ?? "async",
          loading: attribs.loading ?? "lazy",
        },
      }),
      q: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: resolveTagAttributes(attribs, baseUrl, ["cite"]),
      }),
      source: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: resolveTagAttributes(attribs, baseUrl, ["src", "srcset"]),
      }),
      track: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: resolveTagAttributes(attribs, baseUrl, ["src"]),
      }),
      video: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: resolveTagAttributes(attribs, baseUrl, ["poster", "src"]),
      }),
    },
  }) satisfies NonNullable<Parameters<typeof sanitizeHtml>[1]>;

export const sanitizeReaderHtml = (value: string | undefined, baseUrl?: string) => {
  if (!value) {
    return undefined;
  }

  return trimSanitizedHtml(sanitizeHtml(value, createSanitizeHtmlOptions(baseUrl)));
};

export const sanitizeFeedItems = (items: StoredFeedItem[]) =>
  items.map((item) => ({
    ...item,
    contentHtml: sanitizeReaderHtml(item.contentHtml, item.url),
  }));
