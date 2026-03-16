import { useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { useColors, type ThemeColors } from "@/theme";
import { api, type Doc } from "@/lib/convex";
import { refreshDiscoveredFeed } from "@repo/shared/feed/service";
import { stripHtml } from "@repo/shared/feed/utils";
import type { FeedSubscription, StoredFeedItem } from "@repo/shared/feed/types";

function buildReaderHtml(title: string, html: string, colors: ThemeColors) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 17px;
      line-height: 1.7;
      color: ${colors.foreground};
      background: ${colors.background};
      padding: 20px;
      margin: 0;
      -webkit-text-size-adjust: 100%;
    }
    h1 { font-size: 24px; line-height: 1.3; margin: 0 0 16px; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    a { color: ${colors.primary}; }
    pre, code { font-size: 14px; overflow-x: auto; }
    blockquote {
      border-left: 3px solid ${colors.border};
      margin-left: 0;
      padding-left: 16px;
      color: ${colors.mutedForeground};
    }
  </style>
</head>
<body>
  <h1>${title.replace(/</g, "&lt;")}</h1>
  ${html}
</body>
</html>`;
}

export default function ArticleScreen() {
  const colors = useColors();
  const { isAuthenticated } = useConvexAuth();
  const canQuery = isAuthenticated;
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

  const subscriptions = useQuery(
    api.feedSubscriptions.queries.listForCurrentUser,
    canQuery ? {} : "skip",
  ) as FeedSubscription[] | undefined;
  const preferences = useQuery(
    api.preferences.queries.getForCurrentUser,
    canQuery ? {} : "skip",
  );
  const bookmarks = (useQuery(
    api.bookmarks.queries.listForCurrentUser,
    canQuery ? {} : "skip",
  ) ?? []) as Doc<"bookmarks">[];
  const toggleBookmark = useMutation(api.bookmarks.mutations.toggleForCurrentUser);

  const source = subscriptions?.find((s) => s.sourceId === params.sourceId);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [mode, setMode] = useState<"reader" | "site">(preferences?.defaultView ?? "reader");

  const { data } = useTanstackQuery({
    queryKey: ["feed-items", params.sourceId],
    queryFn: () =>
      refreshDiscoveredFeed({
        source: { sourceId: source!.sourceId, feedUrl: source!.feedUrl },
        seenItemIds: [],
      }),
    enabled: !!source,
  });

  const item: StoredFeedItem | undefined = data?.items.find((i) => i.id === params.itemId);

  const fallbackItem = useMemo(
    () =>
      item ?? {
        id: params.itemId,
        sourceId: params.sourceId,
        url: params.url ?? "",
        title: params.title ?? "Saved article",
        excerpt: params.excerpt ?? undefined,
        contentHtml: undefined,
        contentText: undefined,
        publishedAt: params.publishedAt ?? undefined,
        author: undefined,
        imageUrl: params.imageUrl ?? undefined,
      },
    [item, params],
  );

  const articleUrl = fallbackItem.url || undefined;
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.articleTitle, { color: colors.cardForeground }]}>
          {fallbackItem.title}
        </Text>
        {source?.label ? (
          <Text style={[styles.sourceLabel, { color: colors.mutedForeground }]}>
            {source.label}
          </Text>
        ) : null}
      </View>

      {activeMode === "site" && articleUrl ? (
        <WebView source={{ uri: articleUrl }} style={styles.webview} />
      ) : fallbackItem.contentHtml ? (
        <WebView
          source={{ html: buildReaderHtml(fallbackItem.title, fallbackItem.contentHtml, colors) }}
          style={styles.webview}
          originWhitelist={["*"]}
        />
      ) : (
        <ScrollView style={styles.webview} contentContainerStyle={styles.readerContent}>
          {readerText ? (
            <Text style={[styles.readerText, { color: colors.foreground }]}>{readerText}</Text>
          ) : (
            <View
              style={[
                styles.fallback,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.fallbackLabel, { color: colors.mutedForeground }]}>
                Fallback reader mode
              </Text>
              <Text style={[styles.fallbackDesc, { color: colors.mutedForeground }]}>
                Full article content is not available. You can still open the site view or the
                original article.
              </Text>
              {fallbackItem.excerpt ? (
                <Text style={[styles.excerptText, { color: colors.cardForeground }]}>
                  {fallbackItem.excerpt}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.toolbar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.toolbarRow}>
          <Button
            variant="outline"
            style={styles.toolbarBtn}
            disabled={isTogglingBookmark || !articleUrl}
            onPress={() => void handleToggleBookmark()}
          >
            <View style={styles.btnContent}>
              <Ionicons
                name={isBookmarked ? "bookmark" : "bookmark-outline"}
                size={18}
                color={colors.foreground}
              />
              <Text style={[styles.btnLabel, { color: colors.foreground }]}>Bookmark</Text>
            </View>
          </Button>
          <Button
            variant={activeMode === "reader" ? "primary" : "outline"}
            style={styles.toolbarBtn}
            onPress={() => setMode("reader")}
          >
            <View style={styles.btnContent}>
              <Ionicons
                name="book-outline"
                size={18}
                color={activeMode === "reader" ? colors.primaryForeground : colors.foreground}
              />
              <Text
                style={[
                  styles.btnLabel,
                  {
                    color:
                      activeMode === "reader" ? colors.primaryForeground : colors.foreground,
                  },
                ]}
              >
                Reader
              </Text>
            </View>
          </Button>
          <Button
            variant={activeMode === "site" ? "primary" : "outline"}
            style={styles.toolbarBtn}
            disabled={!articleUrl}
            onPress={() => {
              if (!articleUrl) return;
              setMode("site");
            }}
          >
            <View style={styles.btnContent}>
              <Ionicons
                name="globe-outline"
                size={18}
                color={activeMode === "site" ? colors.primaryForeground : colors.foreground}
              />
              <Text
                style={[
                  styles.btnLabel,
                  {
                    color:
                      activeMode === "site" ? colors.primaryForeground : colors.foreground,
                  },
                ]}
              >
                Site
              </Text>
            </View>
          </Button>
        </View>
        <Button
          variant="ghost"
          style={[styles.openOriginal, { borderColor: colors.border, backgroundColor: colors.background }]}
          disabled={!articleUrl}
          onPress={() => {
            if (!articleUrl) return;
            void Linking.openURL(articleUrl);
          }}
        >
          <View style={styles.btnContent}>
            <Ionicons name="open-outline" size={18} color={colors.foreground} />
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>Open original</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  sourceLabel: {
    marginTop: 8,
    fontSize: 14,
  },
  webview: {
    flex: 1,
  },
  readerContent: {
    padding: 20,
    paddingBottom: 132,
  },
  readerText: {
    fontSize: 16,
    lineHeight: 28,
  },
  fallback: {
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  fallbackLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  fallbackDesc: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 26,
  },
  excerptText: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 28,
  },
  toolbar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  toolbarRow: {
    flexDirection: "row",
    gap: 8,
  },
  toolbarBtn: {
    flex: 1,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  openOriginal: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
  },
});
