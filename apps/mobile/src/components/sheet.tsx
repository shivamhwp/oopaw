import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/theme";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  const colors = useColors();

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => onOpenChange(false)}>
      <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)} />
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
        <SafeAreaView edges={["bottom"]} style={styles.content}>
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    opacity: 0.4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
});
