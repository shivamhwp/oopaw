import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk } from "@clerk/expo";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/button";
import { useColors } from "@/theme";
import { api } from "@/lib/convex";
import { defaultUserPreferences } from "@/lib/preferences";

export default function SettingsScreen() {
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const canRunAuthenticatedQueries = isSignedIn && isAuthenticated;
  const colors = useColors();
  const preferences =
    useQuery(api.preferences.queries.getForCurrentUser, canRunAuthenticatedQueries ? {} : "skip") ?? defaultUserPreferences;
  const upsertPreferences = useMutation(api.preferences.mutations.upsertForCurrentUser);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <Ionicons name="settings-outline" size={24} color={colors.foreground} />
        <Text style={[styles.heading, { color: colors.foreground }]}>Settings</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Polling interval</Text>
      <View style={styles.optionRow}>
        {[10, 15, 30, 60].map((value) => (
          <Button
            key={value}
            variant={preferences.pollingIntervalMinutes === value ? "primary" : "outline"}
            style={styles.optionBtn}
            onPress={() => {
              if (!canRunAuthenticatedQueries) return;
              void upsertPreferences({
                pollingIntervalMinutes: value,
                defaultView: preferences.defaultView,
              });
            }}
            label={`${value}m`}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        Default article view
      </Text>
      <View style={styles.optionRow}>
        {(["reader", "site"] as const).map((value) => (
          <Button
            key={value}
            variant={preferences.defaultView === value ? "primary" : "outline"}
            style={styles.optionBtn}
            onPress={() => {
              if (!canRunAuthenticatedQueries) return;
              void upsertPreferences({
                pollingIntervalMinutes: preferences.pollingIntervalMinutes,
                defaultView: value,
              });
            }}
            label={value}
          />
        ))}
      </View>

      <Button
        variant="ghost"
        style={[styles.signOut, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => void clerk.signOut()}
      >
        <View style={styles.signOutContent}>
          <Ionicons name="log-out-outline" size={18} color={colors.foreground} />
          <Text style={[styles.signOutLabel, { color: colors.foreground }]}>Sign out</Text>
        </View>
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 132,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
  },
  sectionLabel: {
    marginTop: 24,
    fontSize: 14,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  optionBtn: {
    flex: 1,
    minWidth: 72,
  },
  signOut: {
    marginTop: 32,
    borderWidth: 1,
    borderRadius: 18,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  signOutContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signOutLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
});
