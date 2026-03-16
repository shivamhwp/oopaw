import { Image, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useConvexAuth, useQuery } from "convex/react";
import { BookmarkSimple } from "phosphor-react-native";
import { useColors } from "@/constants/color";
import { Text } from "@/components/ui/text";
import { api, type Doc } from "@/lib/convex";
import { createFeedItemId, createSourceId } from "@repo/shared/feed/utils";

export default function BookmarksScreen() {
  const colors = useColors();
  const { isSignedIn } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const bookmarks = (useQuery(
    api.bookmarks.queries.listForCurrentUser,
    isSignedIn && isAuthenticated ? {} : "skip",
  ) ?? []) as Doc<"bookmarks">[];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 20, paddingBottom: 132 }}
    >
      {bookmarks.length === 0 ? (
        <View className="items-center rounded-[28px] border border-dashed border-line bg-card px-6 py-12">
          <BookmarkSimple size={32} color={colors.mutedForeground} weight="duotone" />
          <Text className="mt-4 text-xl font-semibold text-card-foreground">No bookmarks yet.</Text>
          <Text className="mt-3 max-w-xs text-center text-base leading-7 text-muted-foreground">
            Save articles from the reader and they will appear here on every device.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {bookmarks.map((bookmark) => {
            const sourceId =
              bookmark.sourceId ?? createSourceId(bookmark.sourceSiteUrl ?? bookmark.url);
            const itemId =
              bookmark.itemId ??
              createFeedItemId(sourceId, [bookmark.url, bookmark.title, bookmark.publishedAt]);

            return (
              <Pressable
                key={bookmark._id}
                className="overflow-hidden rounded-[24px] border border-line bg-card px-4 py-4"
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
                    className="mb-4 h-44 w-full rounded-[18px]"
                    resizeMode="cover"
                  />
                ) : null}
                <Text className="text-lg font-semibold leading-7 text-card-foreground">
                  {bookmark.title}
                </Text>
                {bookmark.sourceLabel ? (
                  <Text className="mt-2 text-sm text-muted-foreground">{bookmark.sourceLabel}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
