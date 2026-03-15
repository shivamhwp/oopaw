import { useEffect } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { CaretRight } from "phosphor-react-native";
import { Button } from "@/components/ui/button";
import { useColors } from "@/constants/color";
import { Text } from "@/components/ui/text";
import { useFeedData } from "@/providers/feed-provider";

export default function FeedScreen() {
  const colors = useColors();
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const { getSource, getSourceItems, loadMore, markRead, refreshSource } = useFeedData();
  const source = getSource(sourceId);
  const items = getSourceItems(sourceId);

  useEffect(() => {
    if (source && items.length === 0) {
      void refreshSource(source.sourceId);
    }
  }, [items.length, refreshSource, source?.sourceId]);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => void refreshSource(sourceId)} />
      }
    >
      <Text className="text-3xl font-semibold">{source?.label ?? "Feed"}</Text>
      <Text className="mt-2 text-sm text-muted">{source?.siteUrl}</Text>

      <View className="mt-6 gap-3">
        {items.map((item) => (
          <Pressable
            key={item.id}
            className="rounded-[24px] border border-line bg-card px-4 py-4"
            onPress={() => {
              markRead(sourceId, item.id);
              router.push(`/article/${sourceId}/${item.id}`);
            }}
          >
            <View className="flex-row items-start gap-3">
              <View
                className={`mt-2 size-2 rounded-full ${item.isRead ? "bg-line" : "bg-accent"}`}
              />
              <View className="flex-1">
                <Text className="text-base font-semibold leading-7">{item.title}</Text>
                {item.excerpt ? (
                  <Text className="mt-2 text-sm leading-6 text-muted">{item.excerpt}</Text>
                ) : null}
              </View>
              <CaretRight size={18} color={colors.mutedForeground} />
            </View>
          </Pressable>
        ))}
      </View>

      {source && (items.length > 0 || source.feedUrl) ? (
        <Button
          className="mt-6"
          variant="outline"
          onPress={() => void loadMore(sourceId)}
          label="Load more"
        />
      ) : null}
    </ScrollView>
  );
}
