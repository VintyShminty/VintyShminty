"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type UserSettings, userSettingsSchema } from "@vinty/shared";
import { clientApi } from "@/lib/api-client";

/** The person's settings (GET /v1/me/settings). `initial` is what the server page already fetched. */
export function useSettings(initial?: UserSettings) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => clientApi("/v1/me/settings", { schema: userSettingsSchema }),
    initialData: initial,
    staleTime: 5 * 60_000,
  });
}

/** PATCH /v1/me/settings. The switch moves straight away and goes back if the server says no, like the app. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserSettings>) =>
      clientApi<UserSettings>("/v1/me/settings", {
        method: "PATCH",
        body: input,
        schema: userSettingsSchema,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<UserSettings>(["settings"]);
      if (previous) queryClient.setQueryData(["settings"], { ...previous, ...input });
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(["settings"], context.previous);
    },
    onSuccess: (settings) => queryClient.setQueryData(["settings"], settings),
  });
}
