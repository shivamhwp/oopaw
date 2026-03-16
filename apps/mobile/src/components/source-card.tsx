import { Pressable, View } from "react-native";
import { Trash, ArrowClockwise } from "phosphor-react-native";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useColors } from "@/constants/color";
import { cn } from "@/lib/utils";
import type { FeedItem, FeedSubscription } from "@repo/shared/feed/types";

type SourceCardProps = {
  source: FeedSubscription;
  items: FeedItem[];
  unreadCount: number;
  newCount: number;
  onPress: () => void;
  onRefresh: () => void;
  onRemove: () => void;
};

export function SourceCard({
  source,
  items,
  unreadCount,
  newCount,
  onPress,
  onRefresh,
  onRemove,
}: SourceCardProps) {
  const colors = useColors();

  return (
    <Pressable onPress={onPress}>
      <Card className="gap-4">
        <View className="flex-row justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-lg font-semibold text-card-foreground">{source.label}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {source.siteUrl.replace(/^https?:\/\//, "")}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onPress={onRefresh}
              accessibilityLabel="Refresh"
              accessibilityHint="Refresh the source"
            >
              <ArrowClockwise size={18} color={colors.foreground} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onPress={onRemove}
              accessibilityLabel="Remove"
              accessibilityHint="Remove the source"
            >
              <Trash size={18} color={colors.destructive} />
            </Button>
          </View>
        </View>

        <View className="gap-2">
          {items.slice(0, 4).map((item) => (
            <View
              key={item.id}
              className="flex-row items-start gap-2 border-b border-line/70 pb-2 last:border-b-0 last:pb-0"
            >
              <View
                className={cn(
                  "mt-1.5 size-1.5 rounded-full",
                  item.isRead ? "bg-line" : "bg-primary",
                )}
              />
              <Text
                className={cn(
                  "flex-1 text-sm leading-6",
                  item.isRead ? "text-muted-foreground" : "text-card-foreground",
                )}
              >
                {item.title}
              </Text>
            </View>
          ))}
          {items.length === 0 ? (
            <Text className="text-sm italic text-muted-foreground">No posts yet.</Text>
          ) : null}
        </View>

        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">{unreadCount} unread</Text>
          {newCount > 0 ? (
            <Text className="text-xs font-semibold text-primary">{newCount} new</Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
