import type { StoredFeedItem } from "@/lib/types";

const trimSanitizedHtml = (value: string) => {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
};

export const sanitizeFeedHtml = async (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const { default: createDOMPurify } = await import("dompurify");

  if (typeof window !== "undefined") {
    return trimSanitizedHtml(createDOMPurify(window).sanitize(value));
  }

  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("");

  try {
    return trimSanitizedHtml(
      createDOMPurify(dom.window as unknown as Parameters<typeof createDOMPurify>[0]).sanitize(
        value,
      ),
    );
  } finally {
    dom.window.close();
  }
};

export const sanitizeFeedItems = async (items: StoredFeedItem[]) =>
  Promise.all(
    items.map(async (item) => ({
      ...item,
      contentHtml: await sanitizeFeedHtml(item.contentHtml),
    })),
  );
