import {
  accounts,
  addresses,
  blocks,
  favourites,
  follows,
  listings,
  notificationPreferences,
  orders,
  profiles,
  pushTokens,
  recentSearches,
  savedSearches,
  sessions,
  userBrands,
  userSettings,
  userSizes,
  users,
  verifications,
} from "@vinty/db";
import {
  deleteAccountInputSchema,
  errorResponseSchema,
  isFinalOrderStatus,
  meSchema,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DEFAULT_ENABLED,
  NOTIFICATION_TYPES,
  notificationPreferenceSchema,
  type OrderStatus,
  updateNotificationPreferencesInputSchema,
  updateProfileInputSchema,
  updateUserSettingsInputSchema,
  userSettingsSchema,
} from "@vinty/shared";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { loadMe } from "../lib/profiles.js";
import { keyBelongsToUser, MAX_UPLOAD_BYTES } from "../lib/storage.js";

const DELETED_NAME = "Deleted member";

const meRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const preHandler = app.requireUser;

  const currentUserId = (request: { session: { user: { id: string } } | null }) => {
    if (!request.session) throw ApiError.unauthenticated();
    return request.session.user.id;
  };

  const loadSettings = async (userId: string) => {
    await db.insert(userSettings).values({ userId }).onConflictDoNothing();
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    if (!row) throw ApiError.notFound();
    return userSettingsSchema.parse(row);
  };

  app.get(
    "/v1/me",
    { preHandler, schema: { response: { 200: meSchema, 401: errorResponseSchema } } },
    async (request) => {
      const me = await loadMe(app, currentUserId(request));
      if (!me) throw ApiError.notFound();
      return me;
    },
  );

  app.patch(
    "/v1/me/profile",
    {
      preHandler,
      schema: {
        body: updateProfileInputSchema,
        response: { 200: meSchema, 401: errorResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const input = request.body;

      if (input.avatarKey && !keyBelongsToUser(input.avatarKey, "avatar", userId)) {
        throw ApiError.invalid("That photo was not uploaded by you", {
          avatarKey: "validation.avatar.invalid",
        });
      }

      if (input.avatarKey) {
        const size = await app.storage.size(input.avatarKey);
        if (size === null)
          throw ApiError.invalid("That photo was not uploaded", { avatarKey: "validation.avatar.invalid" });
        if (size > MAX_UPLOAD_BYTES.avatar) {
          void app.storage.remove(input.avatarKey).catch(() => {});
          throw ApiError.invalid("That photo is too big", { avatarKey: "validation.upload.tooBig" });
        }
      }

      const userChanges: Partial<typeof users.$inferInsert> = {};
      if (input.name !== undefined) userChanges.name = input.name;
      if (input.username !== undefined) {
        const lower = input.username.toLowerCase();
        const [taken] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, lower), ne(users.id, userId)))
          .limit(1);
        if (taken) throw ApiError.conflict("Username is taken", { username: "validation.username.taken" });
        userChanges.username = lower;
        userChanges.displayUsername = input.username;
      }

      const profileChanges: Partial<typeof profiles.$inferInsert> = {};
      if (input.bio !== undefined) profileChanges.bio = input.bio?.trim() ? input.bio.trim() : null;
      if (input.city !== undefined) profileChanges.city = input.city?.trim() ? input.city.trim() : null;
      if (input.countryCode !== undefined) profileChanges.countryCode = input.countryCode.toUpperCase();

      let oldAvatarKey: string | null = null;
      if (input.avatarKey !== undefined) {
        const [current] = await db
          .select({ avatarKey: profiles.avatarKey })
          .from(profiles)
          .where(eq(profiles.userId, userId))
          .limit(1);
        oldAvatarKey = current?.avatarKey ?? null;
        profileChanges.avatarKey = input.avatarKey;
      }

      await db.transaction(async (tx) => {
        if (Object.keys(userChanges).length > 0)
          await tx.update(users).set(userChanges).where(eq(users.id, userId));
        if (Object.keys(profileChanges).length > 0)
          await tx.update(profiles).set(profileChanges).where(eq(profiles.userId, userId));
      });

      if (oldAvatarKey && oldAvatarKey !== input.avatarKey) {
        void app.storage
          .remove(oldAvatarKey)
          .catch((err) => request.log.warn({ err }, "could not delete old avatar"));
      }

      const me = await loadMe(app, userId);
      if (!me) throw ApiError.notFound();
      return me;
    },
  );

  app.get(
    "/v1/me/settings",
    { preHandler, schema: { response: { 200: userSettingsSchema, 401: errorResponseSchema } } },
    async (request) => loadSettings(currentUserId(request)),
  );

  app.patch(
    "/v1/me/settings",
    {
      preHandler,
      schema: {
        body: updateUserSettingsInputSchema,
        response: { 200: userSettingsSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      await loadSettings(userId);
      if (Object.keys(request.body).length > 0) {
        await db.update(userSettings).set(request.body).where(eq(userSettings.userId, userId));
      }
      return loadSettings(userId);
    },
  );

  const preferenceList = z.array(notificationPreferenceSchema);

  /** Every type and channel, with the default filled in where the person never changed it. */
  const loadPreferences = async (userId: string) => {
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    const saved = new Map(rows.map((r) => [`${r.type}:${r.channel}`, r.enabled]));
    return NOTIFICATION_TYPES.flatMap((type) =>
      NOTIFICATION_CHANNELS.map((channel) => ({
        type,
        channel,
        enabled: saved.get(`${type}:${channel}`) ?? NOTIFICATION_DEFAULT_ENABLED,
      })),
    );
  };

  app.get(
    "/v1/me/notification-preferences",
    { preHandler, schema: { response: { 200: preferenceList, 401: errorResponseSchema } } },
    async (request) => loadPreferences(currentUserId(request)),
  );

  app.put(
    "/v1/me/notification-preferences",
    {
      preHandler,
      schema: {
        body: updateNotificationPreferencesInputSchema,
        response: { 200: preferenceList, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      await db
        .insert(notificationPreferences)
        .values(request.body.preferences.map((p) => ({ ...p, userId })))
        .onConflictDoUpdate({
          target: [
            notificationPreferences.userId,
            notificationPreferences.type,
            notificationPreferences.channel,
          ],
          set: { enabled: sql`excluded.enabled`, updatedAt: new Date() },
        });
      return loadPreferences(userId);
    },
  );

  /**
   * Closes the account (open decision 15). The user row stays so orders, reviews and messages keep their
   * history, but every personal field is cleared and nobody can log in to it again.
   */
  app.delete(
    "/v1/me",
    {
      preHandler,
      schema: {
        body: deleteAccountInputSchema.optional(),
        response: {
          204: z.null(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const [credential] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
        .limit(1);

      if (credential) {
        const password = request.body?.password;
        if (!password)
          throw ApiError.invalid("Enter your password", { password: "validation.password.required" });
        try {
          await app.auth.api.verifyPassword({
            body: { password },
            headers: fromNodeHeaders(request.headers),
          });
        } catch {
          throw ApiError.forbidden("That password is not right");
        }
      }

      const open = await db
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId)));
      if (open.some((o) => !isFinalOrderStatus(o.status as OrderStatus))) {
        throw ApiError.conflict("Finish your open orders first");
      }

      const [before] = await db
        .select({ email: users.email, avatarKey: profiles.avatarKey })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(users.id, userId))
        .limit(1);
      if (!before) throw ApiError.notFound();

      await db.transaction(async (tx) => {
        // Others' follower counters follow the follows that disappear.
        await tx.execute(sql`
          update profiles set follower_count = greatest(follower_count - 1, 0)
          where user_id in (select followee_id from follows where follower_id = ${userId})`);
        await tx.execute(sql`
          update profiles set following_count = greatest(following_count - 1, 0)
          where user_id in (select follower_id from follows where followee_id = ${userId})`);
        await tx.delete(follows).where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId)));
        await tx.delete(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));

        // Listings: drafts disappear, everything still for sale is taken down, sold ones stay for the buyer's history.
        await tx.delete(listings).where(and(eq(listings.sellerId, userId), eq(listings.status, "draft")));
        await tx
          .update(listings)
          .set({ status: "removed", statusReason: "account_closed" })
          .where(
            and(eq(listings.sellerId, userId), inArray(listings.status, ["active", "reserved", "hidden"])),
          );

        await Promise.all([
          tx.delete(favourites).where(eq(favourites.userId, userId)),
          tx.delete(savedSearches).where(eq(savedSearches.userId, userId)),
          tx.delete(recentSearches).where(eq(recentSearches.userId, userId)),
          tx.delete(addresses).where(eq(addresses.userId, userId)),
          tx.delete(pushTokens).where(eq(pushTokens.userId, userId)),
          tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId)),
          tx.delete(userSizes).where(eq(userSizes.userId, userId)),
          tx.delete(userBrands).where(eq(userBrands.userId, userId)),
          tx.delete(verifications).where(sql`${verifications.identifier} like ${`%${before.email}%`}`),
          tx.delete(sessions).where(eq(sessions.userId, userId)),
          tx.delete(accounts).where(eq(accounts.userId, userId)),
        ]);

        await tx
          .update(profiles)
          .set({
            bio: null,
            avatarKey: null,
            city: null,
            lastSeenAt: null,
            followerCount: 0,
            followingCount: 0,
            activeListingCount: 0,
            inviteCode: null,
            holidayModeEnabled: false,
            holidayStartedAt: null,
            holidayEndsAt: null,
            deletedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
        await tx
          .update(users)
          .set({
            name: DELETED_NAME,
            email: `deleted-${userId}@deleted.invalid`,
            emailVerified: false,
            image: null,
            username: null,
            displayUsername: null,
          })
          .where(eq(users.id, userId));
      });

      if (before.avatarKey) {
        void app.storage
          .remove(before.avatarKey)
          .catch((err) => request.log.warn({ err }, "could not delete avatar"));
      }
      return reply.code(204).send(null);
    },
  );
};

export default meRoutes;
