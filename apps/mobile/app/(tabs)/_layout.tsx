import { useState } from "react";
import { View } from "react-native";
import { Redirect, Tabs, router } from "expo-router";
import { BookmarkSimple, House, Plus, SlidersHorizontal, SignOut } from "phosphor-react-native";
import { useAuth, useClerk } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useFeedData } from "@/providers/feed-provider";
import { normalizeInputUrl } from "@repo/shared/feed/utils";

export default function TabsLayout() {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const insets = useSafeAreaInsets();
  const { addFeed, preferences, updatePreferences } = useFeedData();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const handleAddFeed = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const sourceId = await addFeed(normalizeInputUrl(url));
      setUrl("");
      setIsAddOpen(false);
      router.push(`/feed/${sourceId}`);
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
          tabBarActiveTintColor: "#0c7a5a",
          tabBarInactiveTintColor: "#8a7b6a",
          tabBarStyle: {
            backgroundColor: "#fff9f1",
            borderTopColor: "#ded2c3",
            height: 68 + insets.bottom,
            paddingBottom: insets.bottom + 10,
          },
          headerStyle: { backgroundColor: "#f6f1e9" },
          headerShadowVisible: false,
          headerTintColor: "#211d1a",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <House color={color} size={size} weight="duotone" />,
            headerRight: () => (
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 size-10"
                onPress={() => setIsSettingsOpen(true)}
              >
                <SlidersHorizontal size={20} color="#211d1a" />
              </Button>
            ),
          }}
        />
        <Tabs.Screen
          name="bookmarks"
          options={{
            title: "Bookmarks",
            tabBarIcon: ({ color, size }) => (
              <BookmarkSimple color={color} size={size} weight="duotone" />
            ),
          }}
        />
      </Tabs>

      <View
        className="absolute items-center self-center"
        style={{ bottom: insets.bottom + 42 }}
        pointerEvents="box-none"
      >
        <Button
          className="size-16 rounded-full shadow-sm"
          size="icon"
          onPress={() => setIsAddOpen(true)}
        >
          <Plus size={26} color="#ffffff" weight="bold" />
        </Button>
      </View>

      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <Text className="text-2xl font-semibold">Add feed</Text>
        <Text className="mt-2 text-sm leading-6 text-muted">
          Paste a direct RSS or Atom feed URL.
        </Text>
        <Input
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-5"
          placeholder="https://example.com/feed.xml"
        />
        {error ? <Text className="mt-3 text-sm text-warn">{error}</Text> : null}
        <Button className="mt-5" onPress={handleAddFeed} loading={isSubmitting} label="Add feed" />
      </Sheet>

      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <Text className="text-2xl font-semibold">Settings</Text>
        <Text className="mt-2 text-sm text-muted">Polling interval</Text>
        <View className="mt-4 flex-row gap-2">
          {[10, 15, 30, 60].map((value) => (
            <Button
              key={value}
              variant={preferences.pollingIntervalMinutes === value ? "primary" : "outline"}
              className="flex-1"
              onPress={() =>
                void updatePreferences({
                  pollingIntervalMinutes: value,
                  defaultView: preferences.defaultView,
                })
              }
              label={`${value}m`}
            />
          ))}
        </View>

        <Text className="mt-6 text-sm text-muted">Default article view</Text>
        <View className="mt-4 flex-row gap-2">
          {(["reader", "site"] as const).map((value) => (
            <Button
              key={value}
              variant={preferences.defaultView === value ? "primary" : "outline"}
              className="flex-1"
              onPress={() =>
                void updatePreferences({
                  pollingIntervalMinutes: preferences.pollingIntervalMinutes,
                  defaultView: value,
                })
              }
              label={value}
            />
          ))}
        </View>

        <Button
          variant="ghost"
          className="mt-6 justify-start rounded-[22px] border border-line bg-card px-4"
          onPress={() => void clerk.signOut()}
        >
          <View className="flex-row items-center gap-3">
            <SignOut size={18} color="#211d1a" />
            <Text className="text-sm font-medium">Sign out</Text>
          </View>
        </Button>
      </Sheet>
    </>
  );
}
