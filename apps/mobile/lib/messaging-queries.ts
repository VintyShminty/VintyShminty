import {
  type InfiniteData,
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type AppNotification,
  type ConversationDetail,
  type ConversationRow,
  conversationDetailSchema,
  conversationPageSchema,
  type ListingDetail,
  type Message,
  messagePageSchema,
  notificationPageSchema,
  type UnreadCounts,
  unreadCountsSchema,
} from "@vinty/shared";
import { api } from "@/lib/api";

// Queries for the inbox, chats, notifications and the red dots (Milestone 4). Keys:
// ["conversations", archived], ["conversation", id], ["messages", id], ["unread"], ["notifications"].
// The socket (lib/realtime.ts) writes into the same caches, so everything also works with it down.

export type Page<T> = { items: T[]; nextCursor: string | null };
export type MessagesData = InfiniteData<Page<Message>, string | undefined>;

const pageQuery = (cursor: string | undefined, limit = 20) =>
  `limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;

/** The inbox (Messages tab) or the archive, newest chat first. */
export const conversationsQuery = (archived: boolean) =>
  infiniteQueryOptions({
    queryKey: ["conversations", archived],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/conversations?${pageQuery(pageParam)}&archived=${archived}`, {
        schema: conversationPageSchema,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** One chat with its item strip and the other person's intro card. */
export const conversationQuery = (id: string) =>
  queryOptions({
    queryKey: ["conversation", id],
    queryFn: () => api<ConversationDetail>(`/v1/conversations/${id}`, { schema: conversationDetailSchema }),
    // Another chat's header must never show while this one loads.
    placeholderData: undefined,
  });

/** The messages of a chat. Page 1 is the newest. */
export const messagesQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: ["messages", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/conversations/${id}/messages?${pageQuery(pageParam, 30)}`, { schema: messagePageSchema }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: undefined,
  });

/** The red dots on the Inbox tab. */
export const unreadQuery = () =>
  queryOptions({
    queryKey: ["unread"],
    queryFn: () => api<UnreadCounts>("/v1/me/unread", { schema: unreadCountsSchema }),
  });

/** The Notifications tab. */
export const notificationsQuery = () =>
  infiniteQueryOptions({
    queryKey: ["notifications"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/v1/me/notifications?${pageQuery(pageParam)}`, { schema: notificationPageSchema }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

// ---- Cache helpers (used by the screens and by the socket) ----

type RowPatch = Partial<ConversationRow>;

/** Changes one row in the inbox and the archive, wherever it is. */
export function patchConversationRow(queryClient: QueryClient, id: string, patch: RowPatch) {
  for (const archived of [false, true]) {
    queryClient.setQueryData<InfiniteData<Page<ConversationRow>, string | undefined>>(
      ["conversations", archived],
      (old) =>
        old && {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
          })),
        },
    );
  }
}

/** Moves a row to the top of the inbox. Returns false when the row is not in the cache. */
export function bumpConversationRow(queryClient: QueryClient, id: string, patch: RowPatch): boolean {
  let found = false;
  queryClient.setQueryData<InfiniteData<Page<ConversationRow>, string | undefined>>(
    ["conversations", false],
    (old) => {
      if (!old) return old;
      const existing = old.pages.flatMap((p) => p.items).find((row) => row.id === id);
      if (!existing) return old;
      found = true;
      const pages = old.pages.map((p) => ({ ...p, items: p.items.filter((row) => row.id !== id) }));
      const first = pages[0];
      if (first) first.items = [{ ...existing, ...patch }, ...first.items];
      return { ...old, pages };
    },
  );
  return found;
}

/** Puts a message into the open thread's cache (or swaps the copy that is already there). */
export function upsertMessage(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<MessagesData>(["messages", message.conversationId], (old) => {
    if (!old) return old;
    const same = (m: Message) =>
      m.id === message.id ||
      (message.clientMessageId !== null &&
        m.clientMessageId === message.clientMessageId &&
        m.senderId === message.senderId);
    if (old.pages.some((p) => p.items.some(same))) {
      return {
        ...old,
        pages: old.pages.map((p) => ({ ...p, items: p.items.map((m) => (same(m) ? message : m)) })),
      };
    }
    const [first, ...rest] = old.pages;
    if (!first) return old;
    return { ...old, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
  });
}

export function setUnread(queryClient: QueryClient, counts: UnreadCounts) {
  queryClient.setQueryData(["unread"], counts);
}

/** Puts a notification at the top of the Notifications tab (or swaps the grouped row it updates). */
export function upsertNotification(queryClient: QueryClient, notification: AppNotification) {
  queryClient.setQueryData<InfiniteData<Page<AppNotification>, string | undefined>>(
    ["notifications"],
    (old) => {
      if (!old) return old;
      const pages = old.pages.map((p) => ({ ...p, items: p.items.filter((n) => n.id !== notification.id) }));
      const first = pages[0];
      if (first) first.items = [notification, ...first.items];
      return { ...old, pages };
    },
  );
}

// ---- Mutations ----

/** Moves the read marker to now, in the caches straight away. The server also tells our other devices. */
export function markConversationReadLocally(queryClient: QueryClient, id: string) {
  patchConversationRow(queryClient, id, { unread: false });
  queryClient.setQueryData<ConversationDetail>(
    ["conversation", id],
    (old) => old && { ...old, unread: false },
  );
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/v1/conversations/${id}/read`, { method: "POST" }),
    onMutate: (id) => markConversationReadLocally(queryClient, id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["unread"] }),
  });
}

/** Archive or restore a chat. It leaves the list it was in at once and goes back if the server says no. */
export function useArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api(`/v1/conversations/${id}/archive`, { method: "PUT", body: { archived } }),
    onMutate: async ({ id, archived }) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      const previous = queryClient.getQueriesData<InfiniteData<Page<ConversationRow>, string | undefined>>({
        queryKey: ["conversations"],
      });
      const row = previous
        .flatMap(([, data]) => data?.pages.flatMap((p) => p.items) ?? [])
        .find((r) => r.id === id);
      queryClient.setQueryData<InfiniteData<Page<ConversationRow>, string | undefined>>(
        ["conversations", !archived],
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((p) => ({ ...p, items: p.items.filter((r) => r.id !== id) })),
          },
      );
      if (row) {
        queryClient.setQueryData<InfiniteData<Page<ConversationRow>, string | undefined>>(
          ["conversations", archived],
          (old) => {
            if (!old) return old;
            const [first, ...rest] = old.pages;
            if (!first) return old;
            const moved = { ...row, archived };
            return {
              ...old,
              pages: [{ ...first, items: [moved, ...first.items.filter((r) => r.id !== id)] }, ...rest],
            };
          },
        );
      }
      queryClient.setQueryData<ConversationDetail>(
        ["conversation", id],
        (old) => old && { ...old, archived },
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["unread"] });
    },
  });
}

export function useMute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      api(`/v1/conversations/${id}/mute`, { method: "PUT", body: { muted } }),
    onMutate: async ({ id, muted }) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      const previous = queryClient.getQueriesData({ queryKey: ["conversations"] });
      const previousDetail = queryClient.getQueryData(["conversation", id]);
      patchConversationRow(queryClient, id, { muted });
      queryClient.setQueryData<ConversationDetail>(["conversation", id], (old) => old && { ...old, muted });
      return { previous, previousDetail };
    },
    onError: (_err, { id }, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
      queryClient.setQueryData(["conversation", id], context?.previousDetail);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["unread"] });
    },
  });
}

/** Asks the seller: opens the existing chat or makes one. */
export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) =>
      api<ConversationDetail>("/v1/conversations", {
        method: "POST",
        body: { listingId },
        schema: conversationDetailSchema,
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(["conversation", detail.id], detail);
      // The item page knows its chat from now on, without loading the page again.
      queryClient.setQueryData<ListingDetail>(
        ["listing", detail.listing.id],
        (old) => old && { ...old, viewer: { ...old.viewer, conversationId: detail.id } },
      );
    },
  });
}

/** Marks notifications read: the given ids, or all of them. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      api("/v1/me/notifications/read", { method: "POST", body: ids ? { ids } : {} }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData(["notifications"]);
      const now = new Date().toISOString();
      queryClient.setQueryData<InfiniteData<Page<AppNotification>, string | undefined>>(
        ["notifications"],
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)),
            })),
          },
      );
      return { previous };
    },
    onError: (_err, _ids, context) => queryClient.setQueryData(["notifications"], context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["unread"] }),
  });
}
