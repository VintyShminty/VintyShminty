"use client";

import { MESSAGE_PREVIEW_MAX } from "@vinty/shared";
import { useSyncExternalStore } from "react";
import { ApiClientError } from "@/lib/api-error";
import { prepareMessagePhoto, uploadMessagePhoto } from "@/lib/message-photo";
import { bumpConversationRow, patchConversationRow, upsertMessage } from "@/lib/messaging-queries";
import { getQueryClient } from "@/lib/query-client";
import { sendMessageLive } from "@/lib/realtime";

/** A message the person sent that the server has not confirmed yet (or could not take). Shown at the end of the chat. */
export type PendingMessage = {
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  kind: "text" | "photo";
  body?: string;
  /** The picture chosen on this computer, shown while it uploads. */
  file?: Blob;
  /** An address for showing `file` (made once, when the message is added). */
  previewUrl?: string;
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

// A small store, outside React, like the one for the live connection.
let pending: PendingMessage[] = [];
const listeners = new Set<() => void>();
const EMPTY: PendingMessage[] = [];
const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const set = (next: PendingMessage[]) => {
  pending = next;
  emit();
};
const patch = (id: string, change: Partial<PendingMessage>) =>
  set(pending.map((m) => (m.clientMessageId === id ? { ...m, ...change } : m)));
const remove = (id: string) => {
  const gone = pending.find((m) => m.clientMessageId === id);
  if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
  set(pending.filter((m) => m.clientMessageId !== id));
};

/** All messages still on their way, in every chat. Pick yours with a filter on `conversationId`. */
export function usePendingMessages(): PendingMessage[] {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => EMPTY,
  );
}

/** A UUID the server uses to recognise a retry of the same message. */
export function newClientMessageId(): string {
  return crypto.randomUUID();
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
  const find = () => pending.find((m) => m.clientMessageId === clientMessageId);
  const message = find();
  if (!message) return;
  const queryClient = getQueryClient();
  try {
    let key = message.attachmentKey;
    let width = message.width;
    let height = message.height;
    if (message.kind === "photo" && !key) {
      const prepared = await prepareMessagePhoto(message.file as Blob);
      const upload = await uploadMessagePhoto(prepared);
      key = upload.key;
      width = prepared.width;
      height = prepared.height;
      patch(clientMessageId, { attachmentKey: key, width, height });
    }
    const current = find() ?? message;
    const sent = await sendMessageLive(
      message.conversationId,
      message.kind === "text"
        ? { clientMessageId, kind: "text", body: current.body ?? "" }
        : { clientMessageId, kind: "photo", attachmentKey: key as string, width, height },
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
  } catch (err) {
    patch(clientMessageId, { state: "failed", ...reasonOf(err) });
  }
}

/** Shows the message at once and sends it in the background. */
export function sendNewMessage(
  message: Omit<PendingMessage, "clientMessageId" | "state" | "createdAt" | "previewUrl">,
): void {
  const clientMessageId = newClientMessageId();
  set([
    ...pending,
    {
      ...message,
      clientMessageId,
      previewUrl: message.file ? URL.createObjectURL(message.file) : undefined,
      state: "sending",
      createdAt: new Date().toISOString(),
    },
  ]);
  void deliver(clientMessageId);
}

export function retryMessage(clientMessageId: string): void {
  patch(clientMessageId, { state: "sending", reason: undefined, retryAfter: undefined });
  void deliver(clientMessageId);
}

export function discardMessage(clientMessageId: string): void {
  remove(clientMessageId);
}
