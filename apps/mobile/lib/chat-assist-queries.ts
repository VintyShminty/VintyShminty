import { queryOptions } from "@tanstack/react-query";
import { type QuickReplies, quickRepliesSchema } from "@vinty/shared";
import { api } from "@/lib/api";

/**
 * Suggested replies for the newest message of a chat (D-039). Cached per chat, message and language, so going back
 * and forth costs nothing. A failure shows nothing (the screen never waits for this).
 */
export const quickRepliesQuery = (conversationId: string, messageId: string, language: "en" | "he") =>
  queryOptions({
    queryKey: ["quick-replies", conversationId, messageId, language],
    queryFn: () =>
      api<QuickReplies>(`/v1/conversations/${conversationId}/quick-replies`, {
        method: "POST",
        body: { language },
        schema: quickRepliesSchema,
      }),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
