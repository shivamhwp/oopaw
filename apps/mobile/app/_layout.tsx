import "react-native-reanimated";

import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { resourceCache } from "@clerk/expo/resource-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/theme";

WebBrowser.maybeCompleteAuthSession();

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
let convex: ConvexReactClient | undefined;

if (convexUrl) {
  convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });
}

const queryClient = new QueryClient();

function LoadingScreen() {
  const colors = useColors();

  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function MissingConfigScreen({ message }: { message: string }) {
  const colors = useColors();

  return (
    <View style={[styles.centered, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
      <Text style={{ color: colors.foreground, textAlign: "center", fontSize: 16 }}>{message}</Text>
    </View>
  );
}

function StackContent() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        contentStyle: {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      }}
    />
  );
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const colorScheme = useColorScheme();
  const colors = useColors();

  if (!publishableKey) {
    return <LoadingScreen />;
  }

  if (!convex) {
    return <MissingConfigScreen message="Missing EXPO_PUBLIC_CONVEX_URL." />;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.flex}>
        <StatusBar
          animated
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <ClerkProvider
          publishableKey={publishableKey}
          tokenCache={tokenCache}
          __experimental_resourceCache={resourceCache}
        >
          <ClerkLoaded>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              <QueryClientProvider client={queryClient}>
                <StackContent />
              </QueryClientProvider>
            </ConvexProviderWithClerk>
          </ClerkLoaded>
        </ClerkProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
