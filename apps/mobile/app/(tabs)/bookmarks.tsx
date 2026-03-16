import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, useQuery } from "convex/react";
import { useColors } from "@/theme";
import { api, type Doc } from "@/lib/convex";
import { createFeedItemId, createSourceId } from "@repo/shared/feed/utils";

export default function BookmarksScreen() {
  const colors = useColors();
  const { isAuthenticated } = useConvexAuth();
  const bookmarks = (useQuery(
    api.bookmarks.queries.listForCurrentUser,
    isAuthenticated ? {} : "skip",
  ) ?? []) as Doc<"bookmarks">[];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {bookmarks.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="bookmark-outline" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.cardForeground }]}>
            No bookmarks yet.
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Save articles from the reader and they will appear here on every device.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {bookmarks.map((bookmark) => {
            const sourceId =
              bookmark.sourceId ?? createSourceId(bookmark.sourceSiteUrl ?? bookmark.url);
            const itemId =
              bookmark.itemId ??
              createFeedItemId(sourceId, [bookmark.url, bookmark.title, bookmark.publishedAt]);

            return (
              <Pressable
                key={bookmark._id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() =>
                  router.push({
                    pathname: "/article/[sourceId]/[itemId]",
                    params: {
                      sourceId,
                      itemId,
                      url: bookmark.url,
                      title: bookmark.title,
                      excerpt: bookmark.excerpt ?? "",
                      imageUrl: bookmark.imageUrl ?? "",
                      sourceLabel: bookmark.sourceLabel ?? "",
                      sourceSiteUrl: bookmark.sourceSiteUrl ?? "",
                      publishedAt: bookmark.publishedAt ?? "",
                    },
                  })
                }
              >
                {bookmark.imageUrl ? (
                  <Image
                    source={{ uri: bookmark.imageUrl }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : null}
                <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>
                  {bookmark.title}
                </Text>
                {bookmark.sourceLabel ? (
                  <Text style={[styles.cardSource, { color: colors.mutedForeground }]}>
                    {bookmark.sourceLabel}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 132,
  },
  empty: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "600",
  },
  emptyDesc: {
    marginTop: 12,
    maxWidth: 280,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 26,
  },
  list: {
    gap: 12,
  },
  card: {
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  image: {
    height: 176,
    width: "100%",
    borderRadius: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
  },
  cardSource: {
    marginTop: 8,
    fontSize: 14,
  },
});
