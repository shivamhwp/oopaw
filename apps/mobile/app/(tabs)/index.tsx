import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useQuery as useTanstackQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/convex";
import { SourceCard } from "@/components/source-card";
import { useColors } from "@/theme";
import { refreshDiscoveredFeed } from "@repo/shared/feed/service";
import type { FeedSubscription } from "@repo/shared/feed/types";

function useSourceItems(source: FeedSubscription, pollingIntervalMs: number) {
  return useTanstackQuery({
    queryKey: ["feed-items", source.sourceId],
    queryFn: () =>
      refreshDiscoveredFeed({
        source: { sourceId: source.sourceId, feedUrl: source.feedUrl },
        seenItemIds: [],
      }),
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: false,
  });
}

function SourceCardWithItems({
  source,
  pollingIntervalMs,
}: {
  source: FeedSubscription;
  pollingIntervalMs: number;
}) {
  const queryClient = useQueryClient();
  const removeSubscription = useMutation(api.feedSubscriptions.mutations.removeForCurrentUser);
  const { data } = useSourceItems(source, pollingIntervalMs);
  const items = data?.items ?? [];

  return (
    <SourceCard
      source={source}
      items={items}
      itemCount={items.length}
      onPress={() => router.push(`/feed/${source.sourceId}`)}
      onRefresh={() =>
        void queryClient.invalidateQueries({ queryKey: ["feed-items", source.sourceId] })
      }
      onRemove={() => void removeSubscription({ sourceId: source.sourceId })}
    />
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const subscriptions = (useQuery(
    api.feedSubscriptions.queries.listForCurrentUser,
    {},
  ) ?? []) as FeedSubscription[];
  const preferences = useQuery(api.preferences.queries.getForCurrentUser, {});
  const queryClient = useQueryClient();
  const pollingIntervalMs = (preferences?.pollingIntervalMinutes ?? 15) * 60_000;

  const handleRefreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["feed-items"] });
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void handleRefreshAll()} />}
    >
      {subscriptions.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.emptyTitle, { color: colors.cardForeground }]}>
            No subscriptions yet.
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Add a feed from the floating plus button. Subscriptions sync across web and mobile.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {subscriptions.map((source) => (
            <SourceCardWithItems
              key={source.sourceId}
              source={source}
              pollingIntervalMs={pollingIntervalMs}
            />
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
  content: {
    padding: 20,
    paddingBottom: 148,
  },
  empty: {
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
  },
  emptyDesc: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 26,
  },
  list: {
    gap: 12,
  },
});
