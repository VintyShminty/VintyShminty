import { Stack } from "expo-router";
import { colors } from "@/theme";

/** The sell form and its category panels. Each panel pushes in from the trailing edge (D-010). */
export default function SellLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="category" />
    </Stack>
  );
}
