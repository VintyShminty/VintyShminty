import { Stack } from "expo-router";
import { colors } from "@/theme";

/** The filter panel and its sub-pages. Each one pushes in from the trailing edge (D-014). */
export default function FiltersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="category" />
      <Stack.Screen name="[kind]" />
    </Stack>
  );
}
