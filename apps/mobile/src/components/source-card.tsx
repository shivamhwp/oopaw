import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/theme";
import type { FeedSubscription, StoredFeedItem } from "@repo/shared/feed/types";

type SourceCardProps = {
  source: FeedSubscription;
  items: StoredFeedItem[];
  itemCount: number;
  isLoading: boolean;
  onPress: () => void;
  onRefresh: () => void;
  onRemove: () => void;
};

export function SourceCard({
  source,
  items,
  itemCount,
  isLoading,
  onPress,
  onRefresh,
  onRemove,
}: SourceCardProps) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.cardForeground }]}>{source.label}</Text>
          <Text style={[styles.url, { color: colors.mutedForeground }]}>
            {source.siteUrl.replace(/^https?:\/\//, "")}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onRefresh} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <View style={styles.items}>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : (
          <>
            {items.slice(0, 4).map((item) => (
              <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                <Text
                  style={[styles.itemTitle, { color: colors.cardForeground }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </View>
            ))}
            {items.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No posts yet.
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          {itemCount} {itemCount === 1 ? "article" : "articles"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  url: {
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  items: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 12,
  },
});
