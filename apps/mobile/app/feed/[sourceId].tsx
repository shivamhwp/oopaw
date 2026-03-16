import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, useQuery } from "convex/react";
import { useQuery as useTanstackQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/convex";
import { useColors } from "@/theme";
import { refreshDiscoveredFeed } from "@repo/shared/feed/service";
import type { FeedSubscription } from "@repo/shared/feed/types";

export default function FeedScreen() {
  const colors = useColors();
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const canQuery = isAuthenticated;
  const subscriptions = useQuery(
    api.feedSubscriptions.queries.listForCurrentUser,
    canQuery ? {} : "skip",
  ) as FeedSubscription[] | undefined;
  const preferences = useQuery(
    api.preferences.queries.getForCurrentUser,
    canQuery ? {} : "skip",
  );
  const source = subscriptions?.find((s) => s.sourceId === sourceId);
  const queryClient = useQueryClient();
  const pollingIntervalMs = (preferences?.pollingIntervalMinutes ?? 15) * 60_000;

  const { data, isLoading } = useTanstackQuery({
    queryKey: ["feed-items", sourceId],
    queryFn: () =>
      refreshDiscoveredFeed({
        source: { sourceId: source!.sourceId, feedUrl: source!.feedUrl },
        seenItemIds: [],
      }),
    enabled: !!source,
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: false,
  });

  const items = data?.items ?? [];

  if (isConvexAuthLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() =>
            void queryClient.invalidateQueries({ queryKey: ["feed-items", sourceId] })
          }
        />
      }
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{source?.label ?? "Feed"}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{source?.siteUrl}</Text>

      {isLoading && items.length === 0 ? (
        <View style={styles.loadingItems}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/article/${sourceId}/${item.id}`)}
            >
              <View style={styles.itemRow}>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.cardForeground }]}>
                    {item.title}
                  </Text>
                  {item.excerpt ? (
                    <Text style={[styles.itemExcerpt, { color: colors.mutedForeground }]}>
                      {item.excerpt}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 96,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
  },
  loadingItems: {
    paddingVertical: 48,
    alignItems: "center",
  },
  list: {
    marginTop: 24,
    gap: 12,
  },
  itemCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  itemExcerpt: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
  },
});
