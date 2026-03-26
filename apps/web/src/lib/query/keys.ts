export const queryKeys = {
  sourceItems: (sourceId: string) => ["source-items", sourceId] as const,
  readerArticle: (itemId: string) => ["reader-article", itemId] as const,
};
