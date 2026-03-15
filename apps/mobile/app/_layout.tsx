import "react-native-url-polyfill/auto";
import "react-native-reanimated";
import "../global.css";

import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, StatusBar, Text, View, useColorScheme } from "react-native";
import { FeedProvider } from "@/providers/feed-provider";
import { secureTokenCache } from "@/lib/auth";
import { useColors } from "@/constants/color";

WebBrowser.maybeCompleteAuthSession();

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
let convex: ConvexReactClient | undefined;

if (convexUrl) {
  convex = new ConvexReactClient(convexUrl);
}

function LoadingScreen() {
  const colors = useColors();

  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function MissingConfigScreen({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-center text-base text-ink">{message}</Text>
    </View>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const colorScheme = useColorScheme();
  const colors = useColors();

  if (!publishableKey) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <LoadingScreen />
      </View>
    );
  }

  if (!convex) {
    return <MissingConfigScreen message="Missing EXPO_PUBLIC_CONVEX_URL." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar
        animated
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <ClerkProvider publishableKey={publishableKey} tokenCache={secureTokenCache}>
        <ClerkLoaded>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <FeedProvider>
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.foreground,
                  headerTitleStyle: { color: colors.foreground },
                  contentStyle: { backgroundColor: colors.background },
                }}
              />
            </FeedProvider>
          </ConvexProviderWithClerk>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
