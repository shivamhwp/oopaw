import { Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

type SheetProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

export function Sheet({ children, open, onOpenChange, className }: SheetProps) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={open}
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable className="flex-1 bg-black/20" onPress={() => onOpenChange(false)}>
        <SafeAreaView className="flex-1 justify-end">
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View
              className={cn(
                "rounded-t-[32px] border border-line bg-canvas px-5 pb-6 pt-3",
                className,
              )}
            >
              <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-line" />
              {children}
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
