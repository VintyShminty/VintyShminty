import { Redirect, useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/profile-view";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

/** A member's public profile, reachable from every tab. Your own id goes to your Profile tab instead. */
export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  if (!session) return <Spinner />;
  if (session.user.id === id) return <Redirect href="/profile" />;
  return <ProfileView userId={id} isSelf={false} />;
}
