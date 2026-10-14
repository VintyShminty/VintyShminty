import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  socketJoinInputSchema,
  socketSendInputSchema,
  socketTypingInputSchema,
} from "@vinty/shared";
import { fromNodeHeaders } from "better-auth/node";
import fp from "fastify-plugin";
import { Server } from "socket.io";
import type { z } from "zod";
import { corsOrigins, type Env } from "../env.js";
import { ApiError } from "../lib/errors.js";
import { WindowLimiter } from "../lib/limiter.js";
import { markRead, requireParty, sendMessage, unreadCounts } from "../lib/messaging.js";
import { createPusher, type Pusher } from "../lib/push.js";
import { createRealtimeAdapter, type RealtimeAdapter } from "../lib/realtime-adapter.js";

type SocketData = { userId: string };
type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** What the rest of the server knows about the socket layer. */
export interface Realtime {
  io: IoServer;
  /** Everything to one person: all of their connected devices. */
  toUser(userId: string): ReturnType<IoServer["to"]>;
  toRooms(rooms: string[]): ReturnType<IoServer["to"]>;
  /** True when one of the person's devices has this thread open. */
  isViewing(userId: string, conversationId: string): Promise<boolean>;
}

declare module "fastify" {
  interface FastifyInstance {
    realtime: Realtime;
    pusher: Pusher;
    /** Message limits from api.md: 60 a minute per person, 20 a minute per person in one chat. */
    messageLimits: { user: WindowLimiter; conversation: WindowLimiter };
  }
}

export type MessagingPluginOptions = { env: Env; pusher?: Pusher };

const TYPING_GAP_MS = 2000;

type Ack = (result: unknown) => void;

export default fp<MessagingPluginOptions>(
  async (app, { env, pusher }) => {
    app.decorate("pusher", pusher ?? createPusher(env, app.log));
    app.decorate("messageLimits", {
      user: new WindowLimiter(60, 60_000),
      conversation: new WindowLimiter(20, 60_000),
    });

    // With REDIS_URL, messages reach people connected to another copy of the server (Vercel). Without it, in memory.
    let shared: RealtimeAdapter | null = null;
    try {
      shared = await createRealtimeAdapter(env, app.log);
    } catch (err) {
      app.log.error(
        { err },
        "could not reach Redis, live chat only reaches people on this copy of the server",
      );
    }

    const io: IoServer = new Server(app.server, {
      ...(shared ? { adapter: shared.adapter } : {}),
      serveClient: false,
      cors: { origin: corsOrigins(env) },
      // Messages are small. A bigger frame is a sign of abuse.
      maxHttpBufferSize: 64 * 1024,
    });
    const realtime: Realtime = {
      io,
      toUser: (userId) => io.to(`user:${userId}`),
      toRooms: (rooms) => io.to(rooms),
      async isViewing(userId, conversationId) {
        const sockets = await io.in(`conversation:${conversationId}`).fetchSockets();
        return sockets.some((s) => s.data.userId === userId);
      },
    };
    app.decorate("realtime", realtime);

    // The handshake carries the same session token the REST calls use as a Bearer header.
    io.use(async (socket, next) => {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== "string" || token.length === 0 || token.length > 2000) {
        return next(new Error("unauthenticated"));
      }
      try {
        const session = await app.auth.api.getSession({
          headers: fromNodeHeaders({ authorization: `Bearer ${token}` }),
        });
        if (!session) return next(new Error("unauthenticated"));
        socket.data.userId = session.user.id;
        next();
      } catch {
        next(new Error("unauthenticated"));
      }
    });

    const fail = (err: unknown) => {
      if (err instanceof ApiError) return { ok: false as const, code: err.code, message: err.message };
      app.log.error({ err }, "socket handler failed");
      return { ok: false as const, code: "internal_error", message: "Something went wrong" };
    };
    const invalid = { ok: false as const, code: "validation_failed", message: "Some fields are not valid" };

    /** Runs a handler, always answers the acknowledgement, never lets an error escape. */
    function handle<S extends z.ZodType>(
      schema: S,
      ack: unknown,
      payload: unknown,
      run: (input: z.infer<S>) => Promise<Record<string, unknown> | undefined>,
    ) {
      const reply: Ack = typeof ack === "function" ? (ack as Ack) : () => {};
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return void reply(invalid);
      run(parsed.data).then(
        (extra) => reply({ ok: true, ...extra }),
        (err) => reply(fail(err)),
      );
    }

    io.on("connection", (socket) => {
      const userId = socket.data.userId;
      void socket.join(`user:${userId}`);
      // Start the red dots right, in case an event was missed while offline.
      unreadCounts(app, userId).then(
        (counts) => socket.emit("unread:count", counts),
        (err) => app.log.warn({ err }, "could not send unread counts"),
      );

      socket.on("conversation:join", (payload, ack) =>
        handle(socketJoinInputSchema, ack, payload, async ({ conversationId }) => {
          await requireParty(app, conversationId, userId);
          await socket.join(`conversation:${conversationId}`);
          return undefined;
        }),
      );
      socket.on("conversation:leave", (payload, ack) =>
        handle(socketJoinInputSchema, ack, payload, async ({ conversationId }) => {
          await socket.leave(`conversation:${conversationId}`);
          return undefined;
        }),
      );
      socket.on("message:send", (payload, ack) =>
        handle(socketSendInputSchema, ack, payload, async ({ conversationId, ...input }) => {
          const { message } = await sendMessage(app, userId, conversationId, input);
          return { message };
        }),
      );
      socket.on("conversation:read", (payload, ack) =>
        handle(socketJoinInputSchema, ack, payload, async ({ conversationId }) => {
          await markRead(app, userId, conversationId);
          return undefined;
        }),
      );

      const lastTyping = new Map<string, number>();
      socket.on("typing", (payload) => {
        const parsed = socketTypingInputSchema.safeParse(payload);
        if (!parsed.success) return;
        const { conversationId, isTyping } = parsed.data;
        const room = `conversation:${conversationId}`;
        // Only someone who joined the thread (and so passed the party check) may type into it.
        if (!socket.rooms.has(room)) return;
        const now = Date.now();
        // "Stopped typing" always goes through, so the other side's dots never get stuck.
        if (isTyping && now - (lastTyping.get(conversationId) ?? 0) < TYPING_GAP_MS) return;
        lastTyping.set(conversationId, now);
        socket.to(room).emit("typing", { conversationId, userId, isTyping });
      });
    });

    // Same recipe as the community wrapper: drop the sockets before Fastify stops listening, then close Socket.IO.
    app.addHook("preClose", async () => {
      io.local.disconnectSockets(true);
    });
    app.addHook("onClose", async () => {
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
      await shared?.close();
    });
  },
  { name: "messaging", dependencies: ["auth"] },
);
