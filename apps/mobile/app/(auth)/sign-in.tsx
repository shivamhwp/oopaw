import { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { GoogleLogo } from "phosphor-react-native";
import { makeRedirectUri } from "expo-auth-session";
import { useAuth, useOAuth } from "@clerk/expo";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function SignInScreen() {
  const { isSignedIn } = useAuth();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSignIn = async () => {
    setError(null);
    setIsPending(true);

    try {
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: makeRedirectUri({ scheme: "oop-mobile" }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Google sign-in failed.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <View className="w-full max-w-sm rounded-[34px] border border-line bg-card px-6 py-8">
        <Text className="text-xs font-medium uppercase tracking-[0.24em] text-muted">
          Mobile Reader
        </Text>
        <Text className="mt-4 text-4xl font-semibold leading-tight">
          Sign in with Google to load your feeds.
        </Text>
        <Text className="mt-4 text-base leading-7 text-muted">
          Subscriptions, bookmarks, and preferences sync through Convex. Articles and read state
          stay local on this device.
        </Text>
        <Button className="mt-8 gap-3" onPress={handleSignIn} loading={isPending}>
          <View className="flex-row items-center gap-3">
            <GoogleLogo size={20} color="#ffffff" />
            <Text className="text-sm font-semibold text-white">Continue with Google</Text>
          </View>
        </Button>
        {error ? <Text className="mt-4 text-sm text-warn">{error}</Text> : null}
      </View>
    </View>
  );
}
