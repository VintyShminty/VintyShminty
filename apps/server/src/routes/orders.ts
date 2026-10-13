import { orders, users } from "@vinty/db";
import {
  adminOrderNoteInputSchema,
  cancelOrderInputSchema,
  checkoutQuoteSchema,
  createOrderInputSchema,
  disputeOrderInputSchema,
  errorResponseSchema,
  idempotencyHeadersSchema,
  idSchema,
  type OrderStatus,
  orderDetailSchema,
  orderPageSchema,
  ordersQuerySchema,
  quoteInputSchema,
} from "@vinty/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { createOrder, quoteCheckout } from "../lib/checkout.js";
import { ApiError } from "../lib/errors.js";
import { keysetCursor, olderThan, tsText } from "../lib/keyset.js";
import {
  type Actor,
  orderRowFields,
  presentOrderDetail,
  presentOrderRows,
  requireOrderParty,
  SYSTEM_ACTOR,
  transitionOrder,
} from "../lib/orders.js";

const idParams = z.object({ id: idSchema });
const WRITE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

const IN_PROGRESS: OrderStatus[] = ["pending_payment", "paid", "shipped", "delivered", "disputed"];

/** Checkout and orders (Milestone 5). The work of every move is in lib/orders.ts. */
const orderRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;

  const userIdOf = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  /** Moderators and admins only. */
  const requireModerator = async (
    request: Parameters<typeof app.requireUser>[0],
    reply: Parameters<typeof app.requireUser>[1],
  ) => {
    await app.requireUser(request, reply);
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userIdOf(request)))
      .limit(1);
    if (!row || row.role === "user") throw ApiError.forbidden();
  };

  const detailFor = async (orderId: string, userId: string) =>
    presentOrderDetail(app, await requireOrderParty(db, orderId, userId), userId);

  // ---- Checkout ----

  app.post(
    "/v1/checkout/quote",
    {
      preHandler,
      schema: { body: quoteInputSchema, response: { 200: checkoutQuoteSchema, ...errors } },
    },
    async (request) => quoteCheckout(app, userIdOf(request), request.body),
  );

  app.post(
    "/v1/orders",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        body: createOrderInputSchema,
        headers: idempotencyHeadersSchema,
        response: { 200: orderDetailSchema, 201: orderDetailSchema, ...errors },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { order, created } = await createOrder(
        app,
        userId,
        request.body,
        request.headers["idempotency-key"],
      );
      return reply.code(created ? 201 : 200).send(await presentOrderDetail(app, order, userId));
    },
  );

  // ---- Reading ----

  app.get(
    "/v1/orders",
    {
      preHandler,
      schema: { querystring: ordersQuerySchema, response: { 200: orderPageSchema, ...errors } },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { role, status, cursor, limit } = request.query;
      const mine =
        role === "bought"
          ? eq(orders.buyerId, userId)
          : // A seller sees an order once it is paid.
            and(eq(orders.sellerId, userId), sql`${orders.paidAt} is not null`);
      const statuses: OrderStatus[] | null =
        status === "in_progress"
          ? IN_PROGRESS
          : status === "cancelled"
            ? ["cancelled", "refunded"]
            : status === "completed"
              ? ["completed"]
              : null;
      const rows = await db
        .select({ ...orderRowFields, cursorTs: tsText(orders.createdAt) })
        .from(orders)
        .where(
          and(
            mine,
            statuses ? inArray(orders.status, statuses) : undefined,
            olderThan(cursor, orders.createdAt, orders.id),
          ),
        )
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: await presentOrderRows(app, userId, page),
        nextCursor: rows.length > limit && last ? keysetCursor(last.cursorTs, last.o.id) : null,
      };
    },
  );

  app.get(
    "/v1/orders/:id",
    { preHandler, schema: { params: idParams, response: { 200: orderDetailSchema, ...errors } } },
    async (request) => detailFor(request.params.id, userIdOf(request)),
  );

  // ---- Moves ----

  app.post(
    "/v1/orders/:id/pay",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        headers: idempotencyHeadersSchema,
        response: { 200: orderDetailSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const order = await requireOrderParty(db, request.params.id, userId);
      if (order.buyerId !== userId) throw ApiError.forbidden("Only the buyer can pay");
      // Paying twice (a double tap, a retry with the same key) answers with the paid order and charges nothing.
      if (order.paidAt && order.status !== "cancelled") return presentOrderDetail(app, order, userId);
      if (order.status === "pending_payment" && order.payByAt && order.payByAt <= new Date()) {
        await transitionOrder(app, order.id, "cancel", SYSTEM_ACTOR, { cancelReason: "payment_expired" });
        throw new ApiError(409, "invalid_transition", "This checkout has expired");
      }
      return presentOrderDetail(
        app,
        await transitionOrder(app, order.id, "pay", { role: "buyer", userId }),
        userId,
      );
    },
  );

  app.post(
    "/v1/orders/:id/ship",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: orderDetailSchema, ...errors } },
    },
    async (request) => {
      const userId = userIdOf(request);
      const order = await requireOrderParty(db, request.params.id, userId);
      if (order.sellerId !== userId) throw ApiError.forbidden("Only the seller can ship");
      return presentOrderDetail(
        app,
        await transitionOrder(app, order.id, "ship", { role: "seller", userId }),
        userId,
      );
    },
  );

  app.post(
    "/v1/orders/:id/confirm-received",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: { params: idParams, response: { 200: orderDetailSchema, ...errors } },
    },
    async (request) => {
      const userId = userIdOf(request);
      const order = await requireOrderParty(db, request.params.id, userId);
      if (order.buyerId !== userId) throw ApiError.forbidden("Only the buyer can confirm");
      return presentOrderDetail(
        app,
        await transitionOrder(app, order.id, "confirm_received", { role: "buyer", userId }),
        userId,
      );
    },
  );

  app.post(
    "/v1/orders/:id/cancel",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: cancelOrderInputSchema,
        response: { 200: orderDetailSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const order = await requireOrderParty(db, request.params.id, userId);
      const actor: Actor = { role: order.buyerId === userId ? "buyer" : "seller", userId };
      const note = request.body.reason;
      return presentOrderDetail(
        app,
        await transitionOrder(app, order.id, "cancel", actor, note ? { note } : {}),
        userId,
      );
    },
  );

  app.post(
    "/v1/orders/:id/dispute",
    {
      preHandler,
      config: WRITE_LIMIT,
      schema: {
        params: idParams,
        body: disputeOrderInputSchema,
        response: { 200: orderDetailSchema, ...errors },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const order = await requireOrderParty(db, request.params.id, userId);
      if (order.buyerId !== userId) throw ApiError.forbidden("Only the buyer can report a problem");
      return presentOrderDetail(
        app,
        await transitionOrder(
          app,
          order.id,
          "open_dispute",
          { role: "buyer", userId },
          { note: request.body.details },
        ),
        userId,
      );
    },
  );

  // ---- Support ----

  for (const [path, event] of [
    ["refund", "refund"],
    ["release", "release"],
  ] as const) {
    app.post(
      `/v1/admin/orders/:id/${path}`,
      {
        preHandler: requireModerator,
        config: WRITE_LIMIT,
        schema: {
          params: idParams,
          body: adminOrderNoteInputSchema,
          response: { 200: orderDetailSchema, ...errors },
        },
      },
      async (request) => {
        const userId = userIdOf(request);
        const note = request.body.note;
        const order = await transitionOrder(
          app,
          request.params.id,
          event,
          { role: "admin", userId },
          note ? { note } : {},
        );
        // Support is not a party, so the order is shown from the buyer's side.
        return presentOrderDetail(app, order, order.buyerId);
      },
    );
  }

  // ---- Development only ----

  if (app.env.NODE_ENV !== "production") {
    // The pretend delivery without waiting: either person of a shipped order can fire it.
    app.post(
      "/v1/dev/orders/:id/deliver",
      {
        preHandler,
        schema: { params: idParams, response: { 200: orderDetailSchema, ...errors } },
      },
      async (request) => {
        const userId = userIdOf(request);
        const order = await requireOrderParty(db, request.params.id, userId);
        await transitionOrder(app, order.id, "deliver", SYSTEM_ACTOR);
        return detailFor(order.id, userId);
      },
    );
  }
};

export default orderRoutes;
