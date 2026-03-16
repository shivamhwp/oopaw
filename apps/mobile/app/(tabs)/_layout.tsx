import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useConvexAuth, useMutation } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { useColors } from "@/theme";
import { api } from "@/lib/convex";
import { normalizeInputUrl } from "@repo/shared/feed/utils";
import { discoverFeed } from "@repo/shared/feed/service";

export default function TabsLayout() {
  const { isSignedIn } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const createSubscription = useMutation(api.feedSubscriptions.mutations.createForCurrentUser);
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const canRunAuthenticatedQueries = isSignedIn && isAuthenticated;

  const handleAddFeed = async () => {
    if (!canRunAuthenticatedQueries) {
      setError("Still connecting — please wait a moment and try again.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const discovery = await discoverFeed(normalizeInputUrl(url));
      await createSubscription(discovery.source);
      await queryClient.invalidateQueries({ queryKey: ["feed-items"] });
      setUrl("");
      setIsAddOpen(false);
      router.push(`/feed/${discovery.source.sourceId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not add feed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 8,
          },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="bookmarks"
          options={{
            title: "Bookmarks",
            tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
          }}
        />
      </Tabs>

      <Pressable
        style={[
          styles.fab,
          {
            right: 16,
            bottom: insets.bottom + 42,
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => setIsAddOpen(true)}
      >
        <Ionicons name="add" size={24} color={colors.primaryForeground} />
      </Pressable>

      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add feed</Text>
        <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>
          Paste a direct RSS or Atom feed URL.
        </Text>
        <Input
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://example.com/feed.xml"
          style={styles.sheetInput}
        />
        {error ? (
          <Text style={[styles.sheetError, { color: colors.destructive }]}>{error}</Text>
        ) : null}
        <Button style={styles.sheetButton} onPress={handleAddFeed} loading={isSubmitting} label="Add feed" />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    zIndex: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "600",
  },
  sheetDesc: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
  },
  sheetInput: {
    marginTop: 20,
  },
  sheetError: {
    marginTop: 12,
    fontSize: 14,
  },
  sheetButton: {
    marginTop: 20,
  },
});
