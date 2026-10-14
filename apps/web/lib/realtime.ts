"use client";

import {
  type ClientToServerEvents,
  type ConversationDetail,
  type Message,
  messageSchema,
  type SendMessageInput,
  type ServerToClientEvents,
} from "@vinty/shared";
import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { clientApi } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { getAuthClient } from "@/lib/auth-client";
import {
  bumpConversationRow,
  markConversationReadLocally,
  patchConversationRow,
  patchMessageOffer,
  setUnread,
  upsertMessage,
  upsertNotification,
} from "@/lib/messaging-queries";
import { getQueryClient } from "@/lib/query-client";

// One live connection for the logged in person, straight to the server (the website's own address cannot carry
// WebSockets, see docs/plans/website.md). Events write into the same TanStack caches the pages read, so a page never
// knows whether news came from the socket or a refetch. Everything also works with the socket down: sending falls
// back to REST and reconnecting refetches what was missed (events are not replayed). Same behaviour as the app.

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type RealtimeState = {
  connected: boolean;
  /** Chats where the other person is typing right now. */
  typing: Record<string, boolean>;
};

let state: RealtimeState = { connected: false, typing: {} };
const listeners = new Set<() => void>();
const SERVER_STATE: RealtimeState = { connected: false, typing: {} };

function setState(patch: Partial<RealtimeState> | ((s: RealtimeState) => Partial<RealtimeState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Reads a part of the live state. Return a plain value (a boolean, a string), not a new object. */
export function useRealtime<T>(select: (s: RealtimeState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(SERVER_STATE),
  );
}

/** How long a typing dot stays if the "stopped typing" event never arrives. */
const TYPING_TTL_MS = 6000;

let socket: AppSocket | null = null;
let me: string | null = null;
let hasConnected = false;
let removePageListeners: (() => void) | null = null;
const openThreads = new Set<string>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const readTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** The session token the server wants in the socket handshake. */
async function readToken(): Promise<string | null> {
  try {
    const { data } = await getAuthClient().getSession();
    return data?.session.token ?? null;
  } catch {
    return null;
  }
}

function setTyping(conversationId: string, isTyping: boolean) {
  clearTimeout(typingTimers.get(conversationId));
  typingTimers.delete(conversationId);
  setState((s) => ({ typing: { ...s.typing, [conversationId]: isTyping } }));
  if (isTyping) {
    typingTimers.set(
      conversationId,
      setTimeout(() => setTyping(conversationId, false), TYPING_TTL_MS),
    );
  }
}

function join(conversationId: string) {
  socket?.emit("conversation:join", { conversationId }, () => {});
}

/** Repairs everything that may have changed while the socket was away. */
function refetchAfterReconnect() {
  const queryClient = getQueryClient();
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["unread"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  void queryClient.invalidateQueries({ queryKey: ["order"] });
  for (const id of openThreads) {
    void queryClient.invalidateQueries({ queryKey: ["messages", id] });
    void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
  }
}

function connect(userId: string) {
  me = userId;
  const queryClient = getQueryClient();
  const s: AppSocket = io(SOCKET_URL, {
    // Read again on every attempt, so a refreshed session is used.
    auth: (cb) => void readToken().then((token) => cb({ token: token ?? "" })),
    transports: ["websocket"],
    reconnectionDelayMax: 10_000,
  });
  socket = s;

  s.on("connect", () => {
    setState({ connected: true });
    for (const id of openThreads) join(id);
    if (hasConnected) refetchAfterReconnect();
    hasConnected = true;
  });
  s.on("disconnect", (reason) => {
    setState({ connected: false, typing: {} });
    // When the server closes the connection on purpose (a restart, or the platform's time limit on connections),
    // socket.io does not try again by itself.
    if (reason === "io server disconnect") setTimeout(() => s.connect(), 1500);
  });
  s.on("connect_error", () => setState({ connected: false }));

  s.on("message:new", ({ conversationId, message }) => {
    upsertMessage(queryClient, message);
    if (message.senderId !== userId) {
      setTyping(conversationId, false);
      // Looking at the chat: it counts as read straight away.
      if (openThreads.has(conversationId) && document.visibilityState === "visible") {
        markThreadRead(conversationId);
      }
    }
  });

  // An offer bubble changed state. The chat header may change too: accepting an offer reserves the item.
  s.on("message:updated", ({ conversationId, offer }) => {
    if (offer) patchMessageOffer(queryClient, conversationId, offer.id, offer);
    void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
  });

  // An item was reserved, sold, released or repriced: the chat strips that show it read it again.
  s.on("listing:updated", () => {
    void queryClient.invalidateQueries({ queryKey: ["conversation"] });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  });

  s.on("conversation:updated", (p) => {
    // Reading a chat sends this event without a kind: keep the preview we already have.
    const patch = {
      lastMessageAt: p.lastMessageAt,
      unread: p.unread,
      ...(p.lastMessageKind
        ? { lastMessagePreview: p.lastMessagePreview, lastMessageKind: p.lastMessageKind }
        : {}),
    };
    patchConversationRow(queryClient, p.conversationId, patch);
    // A new message lifts the chat to the top. If the row is not in the list (a new chat, or one back from the
    // archive) ask the server for the list again.
    if (p.lastMessageKind && !bumpConversationRow(queryClient, p.conversationId, patch)) {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
    queryClient.setQueryData<ConversationDetail>(
      ["conversation", p.conversationId],
      (old) => old && { ...old, unread: p.unread },
    );
  });

  s.on("conversation:read", ({ conversationId, userId: reader, readAt }) => {
    // The other person opened the thread: "Seen" on our last message.
    if (reader === me) return;
    queryClient.setQueryData<ConversationDetail>(
      ["conversation", conversationId],
      (old) => old && { ...old, otherLastReadAt: readAt },
    );
  });

  s.on("notification:new", ({ notification }) => {
    upsertNotification(queryClient, notification);
    void queryClient.invalidateQueries({ queryKey: ["unread"] });
    if (notification.orderId) {
      void queryClient.invalidateQueries({ queryKey: ["order", notification.orderId] });
    }
  });
  s.on("unread:count", (counts) => setUnread(queryClient, counts));
  // An order moved (paid, shipped, delivered...): the tracker card in its chat reads it again.
  s.on("order:updated", ({ orderId, conversationId }) => {
    void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    if (conversationId) void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
  });
  s.on("typing", ({ conversationId, userId: who, isTyping }) => {
    if (who !== me) setTyping(conversationId, isTyping);
  });
}

/** Opens the live connection for this person. Safe to call twice. */
export function startRealtime(userId: string) {
  if (socket && me === userId) return;
  stopRealtime();
  connect(userId);
  // A tab that was asleep (or a laptop that was closed) may have lost the connection and missed news: coming back,
  // connect now instead of waiting for the next retry, and read the red dots again.
  const wake = () => {
    if (document.visibilityState !== "visible" || !socket) return;
    if (!socket.connected) socket.connect();
    void getQueryClient().invalidateQueries({ queryKey: ["unread"] });
  };
  const online = () => socket && !socket.connected && socket.connect();
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", online);
  removePageListeners = () => {
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", online);
  };
}

/** Closes the connection and forgets everything about it (log out). */
export function stopRealtime() {
  removePageListeners?.();
  removePageListeners = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  me = null;
  hasConnected = false;
  openThreads.clear();
  for (const timer of [...typingTimers.values(), ...readTimers.values()]) clearTimeout(timer);
  typingTimers.clear();
  readTimers.clear();
  setState({ connected: false, typing: {} });
}

/** A chat is open on screen. The server uses this for typing, read receipts and to hold back the push. */
export function joinThread(conversationId: string) {
  openThreads.add(conversationId);
  if (socket?.connected) join(conversationId);
}

export function leaveThread(conversationId: string) {
  openThreads.delete(conversationId);
  setTyping(conversationId, false);
  if (socket?.connected) socket.emit("conversation:leave", { conversationId }, () => {});
}

/** Tells the other person we are typing (the server throttles it) or stopped. */
export function sendTyping(conversationId: string, isTyping: boolean) {
  if (socket?.connected) socket.emit("typing", { conversationId, isTyping });
}

/** Moves the read marker to now, over the socket when it is up and over REST otherwise. */
export function markThreadRead(conversationId: string) {
  const queryClient = getQueryClient();
  markConversationReadLocally(queryClient, conversationId);
  clearTimeout(readTimers.get(conversationId));
  readTimers.set(
    conversationId,
    setTimeout(() => {
      readTimers.delete(conversationId);
      const viaRest = () =>
        clientApi(`/v1/conversations/${conversationId}/read`, { method: "POST" })
          .then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }))
          .catch(() => {});
      if (socket?.connected) {
        socket.emit("conversation:read", { conversationId }, (result) => {
          if (!result.ok) void viaRest();
        });
      } else {
        void viaRest();
      }
    }, 300),
  );
}

const STATUS_OF_CODE: Record<string, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  blocked: 403,
  not_found: 404,
  conflict: 409,
  listing_unavailable: 409,
  rate_limited: 429,
};

/**
 * Sends a message. Over the socket when it is connected (a quick answer), and over REST when it is not or the socket
 * does not answer in time. The same clientMessageId makes the second try safe: the server returns the first result.
 */
export async function sendMessageLive(conversationId: string, input: SendMessageInput): Promise<Message> {
  if (socket?.connected) {
    try {
      const result = await socket.timeout(6000).emitWithAck("message:send", { conversationId, ...input });
      if (result.ok) return result.message;
      throw new ApiClientError(STATUS_OF_CODE[result.code] ?? 500, result.code as never, result.message);
    } catch (err) {
      // A real answer from the server (blocked, too fast...) is final. A timeout or a dropped socket goes to REST.
      if (err instanceof ApiClientError) throw err;
    }
  }
  return clientApi<Message>(`/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: input,
    schema: messageSchema,
  });
}
