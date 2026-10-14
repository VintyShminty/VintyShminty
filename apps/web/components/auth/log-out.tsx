"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthClient } from "@/lib/auth-client";
import { events } from "@/lib/events";

/** Logs out through Better Auth, goes to Home and asks the server pages to look again (the top bar shows Log in). */
export function useLogOut(lang: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const logOut = async () => {
    setBusy(true);
    try {
      // What the feed was about to learn goes out before the login ends.
      await events.flush();
      await getAuthClient().signOut();
    } finally {
      setBusy(false);
    }
    router.replace(`/${lang}`);
    router.refresh();
  };
  return { logOut, busy };
}
