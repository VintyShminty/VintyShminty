import { ProfileView } from "@/components/profile-view";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export default function Profile() {
  const { data: session } = authClient.useSession();
  if (!session) return <Spinner />;
  return <ProfileView userId={session.user.id} isSelf />;
}
