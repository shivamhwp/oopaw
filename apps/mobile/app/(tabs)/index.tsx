import { RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useFeedData } from "@/providers/feed-provider";
import { SourceCard } from "@/components/source-card";
import { Text } from "@/components/ui/text";

export default function HomeScreen() {
  const { sourceSummaries, refreshAll, refreshSource, removeFeed } = useFeedData();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refreshAll()} />}
    >
      {sourceSummaries.length === 0 ? (
        <View className="rounded-[34px] border border-dashed border-line bg-card px-6 py-10">
          <Text className="text-2xl font-semibold">No subscriptions yet.</Text>
          <Text className="mt-3 text-base leading-7 text-muted">
            Add a feed from the floating plus button. Subscriptions sync across web and mobile.
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          {sourceSummaries.map((summary) => (
            <SourceCard
              key={summary.source.sourceId}
              source={summary.source}
              items={summary.items}
              unreadCount={summary.unreadCount}
              newCount={summary.newCount}
              onPress={() => router.push(`/feed/${summary.source.sourceId}`)}
              onRefresh={() => void refreshSource(summary.source.sourceId)}
              onRemove={() => void removeFeed(summary.source.sourceId)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
