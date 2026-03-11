export const queryKeys = {
  sourceItems: (sourceId: string) => ["source-items", sourceId] as const,
  article: (itemId: string) => ["article", itemId] as const,
  articleEmbed: (articleUrl: string) => ["article-embed", new URL(articleUrl).origin] as const,
};
