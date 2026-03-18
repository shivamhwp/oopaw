import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { AuthView } from "@clerk/expo/native";
import { useColors } from "@/theme";

export default function SignInScreen() {
  const colors = useColors();
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuthView mode="signInOrUp" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
