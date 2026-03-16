import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { makeRedirectUri } from "expo-auth-session";
import { useAuth, useSSO } from "@clerk/expo";
import { Button } from "@/components/button";
import { useColors } from "@/theme";

export default function SignInScreen() {
  const colors = useColors();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSignIn = async () => {
    setError(null);
    setIsPending(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Button style={styles.button} onPress={handleSignIn} loading={isPending}>
        <View style={styles.buttonContent}>
          <Ionicons name="logo-google" size={20} color={colors.primaryForeground} />
          <Text style={[styles.buttonLabel, { color: colors.primaryForeground }]}>
            Sign in with Google
          </Text>
        </View>
      </Button>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  button: {
    width: "100%",
    maxWidth: 320,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    marginTop: 16,
    fontSize: 14,
    textAlign: "center",
  },
});
