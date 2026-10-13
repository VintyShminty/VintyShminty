import { queryOptions, useQuery } from "@tanstack/react-query";
import { type AuthProviders, authProvidersSchema } from "@vinty/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { api } from "@/lib/api";

/** Which "Continue with ..." buttons the server has keys for. The answer is cached, so the buttons do not blink. */
export const authProvidersQuery = () =>
  queryOptions({
    queryKey: ["auth-providers"],
    queryFn: () => api<AuthProviders>("/v1/auth/providers", { schema: authProvidersSchema }),
    staleTime: 5 * 60 * 1000,
  });

/** Apple's sheet exists on iPhones only, and only when the phone allows it. */
const appleAvailable = () =>
  Platform.OS === "ios" ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false);

/** The buttons to show. Both are false while loading, and when the server cannot be reached. */
export function useSocialProviders(): AuthProviders {
  const { data } = useQuery(authProvidersQuery());
  const { data: apple } = useQuery({
    queryKey: ["apple-available"],
    queryFn: appleAvailable,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return { apple: Boolean(data?.apple && apple), google: Boolean(data?.google) };
}
