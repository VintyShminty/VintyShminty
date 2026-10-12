import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { colors } from "@/theme";

/** The sell form and its category panels. Each panel pushes in from the trailing edge (D-010). */
export default function SellLayout() {
  // The form is a native full-screen modal, which sits above the app's own sheet host. It gets its own host so its
  // pickers open on top of it.
  return (
    <BottomSheetModalProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="category" />
      </Stack>
    </BottomSheetModalProvider>
  );
}
