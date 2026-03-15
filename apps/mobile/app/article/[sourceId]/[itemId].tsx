import { useEffect, useMemo, useState } from "react";
import { Dimensions, Linking, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import RenderHtml from "react-native-render-html";
import { WebView } from "react-native-webview";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowSquareOut,
  BookOpenText,
  BookmarkSimple,
  GlobeHemisphereWest,
} from "phosphor-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api, type Doc } from "@/lib/convex";
import { useFeedData } from "@/providers/feed-provider";
import { stripHtml } from "@repo/shared/feed/utils";

export default function ArticleScreen() {
  const { isSignedIn } = useAuth();
  const params = useLocalSearchParams<{
    sourceId: string;
    itemId: string;
    url?: string;
    title?: string;
    excerpt?: string;
    sourceLabel?: string;
    sourceSiteUrl?: string;
    publishedAt?: string;
    imageUrl?: string;
  }>();
  const { width } = Dimensions.get("window");
  const { preferences, ensureItem, getSource, markRead } = useFeedData();
  const bookmarks = (useQuery(api.bookmarks.queries.listForCurrentUser, isSignedIn ? {} : "skip") ??
    []) as Doc<"bookmarks">[];
  const toggleBookmark = useMutation(api.bookmarks.mutations.toggleForCurrentUser);
  const [item, setItem] = useState<Awaited<ReturnType<typeof ensureItem>>>();
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [mode, setMode] = useState<"reader" | "site">(preferences.defaultView);
  const source = getSource(params.sourceId);

  useEffect(() => {
    void (async () => {
      const resolved = await ensureItem(params.sourceId, params.itemId);
      setItem(resolved);
      markRead(params.sourceId, params.itemId);
    })();
  }, [params.itemId, params.sourceId, ensureItem, markRead]);

  const articleUrl = item?.url ?? params.url;
  const fallbackItem = useMemo(
    () =>
      item ?? {
        id: params.itemId,
        sourceId: params.sourceId,
        url: articleUrl,
        title: params.title ?? "Saved article",
        excerpt: params.excerpt ?? undefined,
        contentHtml: undefined,
        contentText: undefined,
        publishedAt: params.publishedAt ?? undefined,
        author: undefined,
        imageUrl: params.imageUrl ?? undefined,
        isNew: false,
        isRead: true,
      },
    [
      item,
      params.excerpt,
      params.imageUrl,
      params.itemId,
      params.publishedAt,
      params.sourceId,
      params.title,
      articleUrl,
    ],
  );
  const activeMode = mode === "site" && articleUrl ? "site" : "reader";
  const isBookmarked = articleUrl
    ? bookmarks.some((bookmark) => bookmark.url === articleUrl)
    : false;
  const readerText = fallbackItem.contentText ?? stripHtml(fallbackItem.contentHtml);
  const handleToggleBookmark = async () => {
    if (isTogglingBookmark || !articleUrl) return;

    setIsTogglingBookmark(true);

    try {
      await toggleBookmark({
        sourceId: source?.sourceId,
        itemId: fallbackItem.id,
        url: articleUrl,
        title: fallbackItem.title,
        excerpt: fallbackItem.excerpt,
        imageUrl: fallbackItem.imageUrl,
        sourceLabel: source?.label ?? params.sourceLabel,
        sourceSiteUrl: source?.siteUrl ?? params.sourceSiteUrl,
        publishedAt: fallbackItem.publishedAt,
      });
    } finally {
      setIsTogglingBookmark(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <View className="border-b border-line bg-card px-4 py-3">
        <Text className="text-2xl font-semibold leading-tight">{fallbackItem.title}</Text>
        {source?.label ? <Text className="mt-2 text-sm text-muted">{source.label}</Text> : null}
      </View>

      {activeMode === "site" && articleUrl ? (
        <WebView source={{ uri: articleUrl }} className="flex-1" />
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {fallbackItem.contentHtml ? (
            <RenderHtml contentWidth={width - 32} source={{ html: fallbackItem.contentHtml }} />
          ) : readerText ? (
            <Text className="text-base leading-8">{readerText}</Text>
          ) : (
            <View className="rounded-[28px] border border-dashed border-line bg-card px-5 py-5">
              <Text className="text-sm font-medium text-muted">Fallback reader mode</Text>
              <Text className="mt-3 text-base leading-7 text-muted">
                Full article content is not available in the cached feed item. You can still open
                the site view or the original article.
              </Text>
              {fallbackItem.excerpt ? (
                <Text className="mt-4 text-lg leading-8">{fallbackItem.excerpt}</Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}

      <View className="border-t border-line bg-card px-4 pb-6 pt-3">
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={isTogglingBookmark || !articleUrl}
            onPress={() => void handleToggleBookmark()}
          >
            <View className="flex-row items-center justify-center gap-2">
              <BookmarkSimple
                size={18}
                color="#211d1a"
                weight={isBookmarked ? "fill" : "regular"}
              />
              <Text className="text-sm font-medium">Bookmark</Text>
            </View>
          </Button>
          <Button
            variant={activeMode === "reader" ? "primary" : "outline"}
            className="flex-1"
            onPress={() => setMode("reader")}
          >
            <View className="flex-row items-center justify-center gap-2">
              <BookOpenText size={18} color={activeMode === "reader" ? "#ffffff" : "#211d1a"} />
              <Text
                className={`text-sm font-medium ${
                  activeMode === "reader" ? "text-white" : "text-ink"
                }`}
              >
                Reader
              </Text>
            </View>
          </Button>
          <Button
            variant={activeMode === "site" ? "primary" : "outline"}
            className="flex-1"
            disabled={!articleUrl}
            onPress={() => {
              if (!articleUrl) return;

              setMode("site");
            }}
          >
            <View className="flex-row items-center justify-center gap-2">
              <GlobeHemisphereWest
                size={18}
                color={activeMode === "site" ? "#ffffff" : "#211d1a"}
              />
              <Text
                className={`text-sm font-medium ${
                  activeMode === "site" ? "text-white" : "text-ink"
                }`}
              >
                Site
              </Text>
            </View>
          </Button>
        </View>
        <Button
          variant="ghost"
          className="mt-3 rounded-[22px] border border-line bg-canvas"
          disabled={!articleUrl}
          onPress={() => {
            if (!articleUrl) return;

            void Linking.openURL(articleUrl);
          }}
        >
          <View className="flex-row items-center justify-center gap-2">
            <ArrowSquareOut size={18} color="#211d1a" />
            <Text className="text-sm font-medium">Open original</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}
