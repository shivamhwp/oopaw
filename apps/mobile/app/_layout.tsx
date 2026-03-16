import "react-native-url-polyfill/auto";
import "react-native-reanimated";
import "../global.css";

import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, StatusBar, Text, View, useColorScheme } from "react-native";
import { GluestackUIProvider } from "@root/components/ui/gluestack-ui-provider";
import { FeedProvider } from "@/providers/feed-provider";
import { secureTokenCache } from "@/lib/auth";
import { NAV_THEME } from "@/lib/theme";
import { useColors } from "@/constants/color";

WebBrowser.maybeCompleteAuthSession();

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
let convex: ConvexReactClient | undefined;

if (convexUrl) {
  convex = new ConvexReactClient(convexUrl);
}

const getProviderMode = (colorScheme: ReturnType<typeof useColorScheme>) =>
  colorScheme === "light" || colorScheme === "dark" ? colorScheme : "system";

function LoadingScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();

  return (
    <GluestackUIProvider mode={getProviderMode(colorScheme)}>
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={colors.primary} />
      </View>
    </GluestackUIProvider>
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
  const theme = NAV_THEME[colorScheme === "dark" ? "dark" : "light"];

  if (!publishableKey) {
    return <LoadingScreen />;
  }

  if (!convex) {
    return <MissingConfigScreen message="Missing EXPO_PUBLIC_CONVEX_URL." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode={getProviderMode(colorScheme)}>
        <ThemeProvider value={theme}>
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
                  <PortalHost />
                </FeedProvider>
              </ConvexProviderWithClerk>
            </ClerkLoaded>
          </ClerkProvider>
        </ThemeProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
