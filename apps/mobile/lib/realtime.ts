import {
  type ClientToServerEvents,
  type ConversationDetail,
  type Message,
  messageSchema,
  type SendMessageInput,
  type ServerToClientEvents,
} from "@vinty/shared";
import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { ApiClientError, api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/config";
import {
  bumpConversationRow,
  markConversationReadLocally,
  patchConversationRow,
  setUnread,
  upsertMessage,
  upsertNotification,
} from "@/lib/messaging-queries";
import { applyListingUpdate, patchMessageOffer } from "@/lib/order-flow-queries";
import { refreshAfterOrderChange } from "@/lib/orders-queries";
import { queryClient } from "@/lib/query-client";

// One live connection for the signed in person (docs/blueprint/api.md, Socket.IO). Events write into the same
// TanStack caches the screens read, so a screen never knows whether news came from the socket or a refetch.
// Everything also works with the socket down: sending falls back to REST and reconnecting refetches what was missed.

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type RealtimeState = {
  connected: boolean;
  /** Chats where the other person is typing right now. */
  typing: Record<string, boolean>;
};
export const useRealtimeStore = create<RealtimeState>(() => ({ connected: false, typing: {} }));

/** How long a typing dot stays if the "stopped typing" event never arrives. */
const TYPING_TTL_MS = 6000;

let socket: AppSocket | null = null;
let me: string | null = null;
let hasConnected = false;
let appStateSub: { remove: () => void } | null = null;
const openThreads = new Set<string>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const readTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** The session token the server wants in the socket handshake: the value of the session cookie. */
async function readToken(): Promise<string | null> {
  const cookie = await authClient.getCookie();
  const match = /session_token=([^;]+)/.exec(cookie ?? "");
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function setTyping(conversationId: string, isTyping: boolean) {
  clearTimeout(typingTimers.get(conversationId));
  typingTimers.delete(conversationId);
  useRealtimeStore.setState((s) => ({ typing: { ...s.typing, [conversationId]: isTyping } }));
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

/** Repairs everything that may have changed while the socket was away (events are not replayed). */
function refetchAfterReconnect() {
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["unread"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  void queryClient.invalidateQueries({ queryKey: ["orders"] });
  void queryClient.invalidateQueries({ queryKey: ["order"] });
  void queryClient.invalidateQueries({ queryKey: ["balance"] });
  // Offers (the bubbles are inside the messages) and items (reserved, sold, repriced) may have moved too.
  void queryClient.invalidateQueries({ queryKey: ["offer-quota"] });
  void queryClient.invalidateQueries({ queryKey: ["listing"] });
  for (const id of openThreads) {
    void queryClient.invalidateQueries({ queryKey: ["messages", id] });
    void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
  }
}

function connect(userId: string) {
  me = userId;
  const s: AppSocket = io(API_URL, {
    // Read again on every attempt, so a refreshed session is used.
    auth: (cb) => void readToken().then((token) => cb({ token: token ?? "" })),
    transports: ["websocket"],
    reconnectionDelayMax: 10_000,
  });
  socket = s;

  s.on("connect", () => {
    if (__DEV__) console.log("[realtime] connected");
    useRealtimeStore.setState({ connected: true });
    for (const id of openThreads) join(id);
    if (hasConnected) refetchAfterReconnect();
    hasConnected = true;
  });
  s.on("disconnect", (reason) => {
    if (__DEV__) console.log("[realtime] disconnected", reason);
    useRealtimeStore.setState({ connected: false, typing: {} });
    // When the server closes the connection on purpose (a restart), socket.io does not try again by itself.
    if (reason === "io server disconnect") setTimeout(() => s.connect(), 1500);
  });
  s.on("connect_error", (err) => {
    if (__DEV__) console.log("[realtime] connect_error", err.message);
    useRealtimeStore.setState({ connected: false });
  });

  s.on("message:new", ({ conversationId, message }) => {
    upsertMessage(queryClient, message);
    if (message.senderId !== userId) {
      setTyping(conversationId, false);
      // Looking at the chat: it counts as read straight away.
      if (openThreads.has(conversationId)) markThreadRead(conversationId);
    }
  });

  // An offer bubble changed state (accepted, declined, countered...). The chat header may change too: accepting an
  // offer reserves the item.
  s.on("message:updated", ({ conversationId, offer }) => {
    if (offer) patchMessageOffer(queryClient, conversationId, offer.id, offer);
    void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["offer-quota"] });
  });

  // An item was reserved, sold, released or repriced: every list that shows it follows.
  s.on("listing:updated", (update) => applyListingUpdate(queryClient, update));

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
    // News about an order (a review came in, money was released...) changes what its page shows.
    if (notification.orderId) void queryClient.invalidateQueries({ queryKey: ["order", notification.orderId] });
  });
  s.on("unread:count", (counts) => setUnread(queryClient, counts));
  // An order moved (paid, shipped, delivered...): My orders, the open order page and the balance read it again.
  s.on("order:updated", ({ orderId, conversationId }) => {
    void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    refreshAfterOrderChange(queryClient);
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
  // iOS closes sockets in the background. Coming back, reconnect now instead of waiting for the next retry.
  appStateSub = AppState.addEventListener("change", (state) => {
    if (state !== "active" || !socket) return;
    if (!socket.connected) socket.connect();
    void queryClient.invalidateQueries({ queryKey: ["unread"] });
  });
}

/** Closes the connection and forgets everything about it (sign out). */
export function stopRealtime() {
  appStateSub?.remove();
  appStateSub = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  me = null;
  hasConnected = false;
  openThreads.clear();
  for (const timer of [...typingTimers.values(), ...readTimers.values()]) clearTimeout(timer);
  typingTimers.clear();
  readTimers.clear();
  useRealtimeStore.setState({ connected: false, typing: {} });
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
  markConversationReadLocally(queryClient, conversationId);
  clearTimeout(readTimers.get(conversationId));
  readTimers.set(
    conversationId,
    setTimeout(() => {
      readTimers.delete(conversationId);
      if (socket?.connected) {
        socket.emit("conversation:read", { conversationId }, (result) => {
          if (!result.ok)
            void api(`/v1/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
        });
      } else {
        void api(`/v1/conversations/${conversationId}/read`, { method: "POST" })
          .then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }))
          .catch(() => {});
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
  return api<Message>(`/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: input,
    schema: messageSchema,
  });
}
