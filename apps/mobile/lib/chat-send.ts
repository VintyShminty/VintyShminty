import { MESSAGE_PREVIEW_MAX } from "@vinty/shared";
import { create } from "zustand";
import { ApiClientError } from "@/lib/api";
import { type PickedPhoto, shrinkPhoto, uploadListingPhoto } from "@/lib/listing-photos";
import { bumpConversationRow, patchConversationRow, upsertMessage } from "@/lib/messaging-queries";
import { askForPushAfterFirstMessage } from "@/lib/push";
import { queryClient } from "@/lib/query-client";
import { sendMessageLive } from "@/lib/realtime";

/** A message the person sent that the server has not confirmed yet (or could not take). Shown at the end of the chat. */
export type PendingMessage = {
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  kind: "text" | "photo";
  body?: string;
  /** Photo on the phone, shown while it uploads. */
  uri?: string;
  width?: number;
  height?: number;
  /** Set once the photo is uploaded, so a retry does not upload it again. */
  attachmentKey?: string;
  state: "sending" | "failed";
  /** Why it failed, for the line under the bubble. */
  reason?: "blocked" | "tooFast" | "network" | "other";
  retryAfter?: number;
  createdAt: string;
};

type ChatStore = {
  pending: PendingMessage[];
  add: (message: PendingMessage) => void;
  patch: (clientMessageId: string, patch: Partial<PendingMessage>) => void;
  remove: (clientMessageId: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  pending: [],
  add: (message) => set((s) => ({ pending: [...s.pending, message] })),
  patch: (clientMessageId, patch) =>
    set((s) => ({
      pending: s.pending.map((m) => (m.clientMessageId === clientMessageId ? { ...m, ...patch } : m)),
    })),
  remove: (clientMessageId) =>
    set((s) => ({ pending: s.pending.filter((m) => m.clientMessageId !== clientMessageId) })),
}));

/** A UUID the server uses to recognise a retry of the same message. Not a secret, so Math.random is fine as a fallback. */
export function newClientMessageId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });
}

function reasonOf(err: unknown): Pick<PendingMessage, "reason" | "retryAfter"> {
  if (err instanceof ApiClientError) {
    if (err.code === "blocked") return { reason: "blocked" };
    if (err.status === 429) return { reason: "tooFast", retryAfter: err.retryAfter };
    if (err.code === "network") return { reason: "network" };
  }
  return { reason: "other" };
}

/** Uploads the photo (if needed) and sends. On success the confirmed message replaces the pending one. */
async function deliver(clientMessageId: string): Promise<void> {
  const { patch, remove } = useChatStore.getState();
  const find = () => useChatStore.getState().pending.find((m) => m.clientMessageId === clientMessageId);
  const message = find();
  if (!message) return;
  try {
    let key = message.attachmentKey;
    if (message.kind === "photo" && !key) {
      const source: PickedPhoto = {
        uri: message.uri as string,
        width: message.width ?? 1,
        height: message.height ?? 1,
      };
      const small = await shrinkPhoto(source);
      const upload = await uploadListingPhoto(small, () => {}, "message_photo");
      key = upload.key;
      patch(clientMessageId, {
        attachmentKey: key,
        uri: small.uri,
        width: small.width,
        height: small.height,
      });
    }
    const current = find() ?? message;
    const sent = await sendMessageLive(
      message.conversationId,
      message.kind === "text"
        ? { clientMessageId, kind: "text", body: current.body ?? "" }
        : {
            clientMessageId,
            kind: "photo",
            attachmentKey: key as string,
            width: current.width,
            height: current.height,
          },
    );
    // Put the confirmed copy in the chat and take the pending one out in the same moment, so nothing flickers.
    upsertMessage(queryClient, sent);
    remove(clientMessageId);
    // With the socket down nobody tells the inbox, so do it here.
    const preview =
      sent.kind === "text" ? (sent.body ?? "").replace(/\s+/g, " ").slice(0, MESSAGE_PREVIEW_MAX) : null;
    const rowPatch = {
      lastMessagePreview: preview,
      lastMessageKind: sent.kind,
      lastMessageAt: sent.createdAt,
      unread: false,
    };
    patchConversationRow(queryClient, sent.conversationId, rowPatch);
    if (!bumpConversationRow(queryClient, sent.conversationId, rowPatch)) {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
    void askForPushAfterFirstMessage(message.senderId);
  } catch (err) {
    if (__DEV__) console.log("Message not sent:", err instanceof Error ? err.message : err);
    patch(clientMessageId, { state: "failed", ...reasonOf(err) });
  }
}

/** Shows the message at once and sends it in the background. */
export function sendNewMessage(
  message: Omit<PendingMessage, "clientMessageId" | "state" | "createdAt">,
): void {
  const clientMessageId = newClientMessageId();
  useChatStore.getState().add({
    ...message,
    clientMessageId,
    state: "sending",
    createdAt: new Date().toISOString(),
  });
  void deliver(clientMessageId);
}

export function retryMessage(clientMessageId: string): void {
  useChatStore
    .getState()
    .patch(clientMessageId, { state: "sending", reason: undefined, retryAfter: undefined });
  void deliver(clientMessageId);
}

export function discardMessage(clientMessageId: string): void {
  useChatStore.getState().remove(clientMessageId);
}
