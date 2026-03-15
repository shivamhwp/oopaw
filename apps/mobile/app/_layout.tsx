import "react-native-url-polyfill/auto";
import "react-native-reanimated";
import "../global.css";

import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, View } from "react-native";
import { FeedProvider } from "@/providers/feed-provider";
import { secureTokenCache } from "@/lib/auth";

WebBrowser.maybeCompleteAuthSession();

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL ?? "");

function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator color="#0c7a5a" />
    </View>
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <LoadingScreen />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={secureTokenCache}>
        <ClerkLoaded>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <FeedProvider>
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: "#f6f1e9" },
                  headerTintColor: "#211d1a",
                  contentStyle: { backgroundColor: "#f6f1e9" },
                }}
              />
            </FeedProvider>
          </ConvexProviderWithClerk>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
