export const queryKeys = {
  sourceItems: (sourceId: string) => ["source-items", sourceId] as const,
  article: (itemId: string) => ["article", itemId] as const,
  articleEmbed: (itemId: string) => ["article-embed", itemId] as const,
};
