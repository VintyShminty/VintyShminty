"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useViewer } from "@/components/site-context";
import { isOnboardingPending } from "@/lib/onboarding";

/**
 * Sends a person who just made an account and has not answered the two welcome questions to them, once, like the app
 * does. It reads a small mark kept in this browser (set at sign up, cleared when they finish or skip). Logging in to an
 * old account never sets it. The account pages themselves are left alone so the sign up steps are not interrupted.
 */
export function OnboardingGate({ lang }: { lang: string }) {
  const viewer = useViewer();
  const pathname = usePathname();
  const router = useRouter();
  const userId = viewer?.id;
  const quiet = ["/sign-up", "/log-in", "/forgot-password", "/welcome-questions"].some((p) =>
    pathname.startsWith(`/${lang}${p}`),
  );

  useEffect(() => {
    if (userId && !quiet && isOnboardingPending(userId)) router.replace(`/${lang}/welcome-questions`);
  }, [userId, quiet, lang, router]);

  return null;
}
