import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { Spinner } from "@/components/ui/spinner";
import { meQuery } from "@/lib/queries";
import { colors } from "@/theme";

/** The admin batch upload. Only admins get past this. The server checks the role on every call as well. */
export default function AdminUploadLayout() {
  const me = useQuery(meQuery());
  if (me.isPending) return <Spinner className="flex-1" />;
  if (!me.data?.isAdmin) return <Redirect href="/" />;
  // A full-screen modal sits above the app's own sheet host, so the pickers need a host of their own.
  return (
    <BottomSheetModalProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
      </Stack>
    </BottomSheetModalProvider>
  );
}
