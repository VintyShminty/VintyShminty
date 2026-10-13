import {
  accounts,
  badgeDefinitions,
  blocks,
  follows,
  profiles,
  userBadges,
  userSettings,
  users,
} from "@vinty/db";
import type { Locale, Me, PublicProfile, UserSummary } from "@vinty/shared";
import { and, eq, isNotNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { isAway } from "./away.js";

const average = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * 100) / 100 : null);

type Deps = Pick<FastifyInstance, "db" | "storage">;

/** The public face of one person, as the Profile screen needs it. Null when missing or closed. */
export async function loadPublicProfile(
  { db, storage }: Deps,
  userId: string,
  viewerId?: string,
): Promise<PublicProfile | null> {
  const [row] = await db
    .select({ user: users, profile: profiles, showLastSeen: userSettings.showLastSeen })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.profile.deletedAt) return null;
  const { user, profile } = row;
  const isSelf = viewerId === userId;

  const [badgeRows, googleRows, viewerRows] = await Promise.all([
    db
      .select({
        slug: badgeDefinitions.slug,
        icon: badgeDefinitions.icon,
        nameEn: badgeDefinitions.nameEn,
        nameHe: badgeDefinitions.nameHe,
      })
      .from(userBadges)
      .innerJoin(badgeDefinitions, eq(badgeDefinitions.id, userBadges.badgeId))
      .where(
        and(
          eq(userBadges.userId, userId),
          isNotNull(userBadges.earnedAt),
          eq(badgeDefinitions.showOnProfile, true),
        ),
      ),
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")))
      .limit(1),
    viewerId && !isSelf
      ? Promise.all([
          db
            .select({ id: follows.followerId })
            .from(follows)
            .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId)))
            .limit(1),
          db
            .select({ id: blocks.blockerId })
            .from(blocks)
            .where(and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, userId)))
            .limit(1),
        ])
      : Promise.resolve(null),
  ]);

  const member = {
    count: profile.memberReviewCount,
    average: average(profile.memberRatingSum, profile.memberReviewCount),
  };
  const automatic = {
    count: profile.automaticReviewCount,
    average: average(profile.automaticRatingSum, profile.automaticReviewCount),
  };

  return {
    id: user.id,
    username: user.displayUsername ?? user.username,
    name: user.name,
    avatarUrl: profile.avatarKey ? storage.publicUrl(profile.avatarKey) : null,
    ratingAverage: member.average,
    reviewCount: member.count,
    bio: profile.bio,
    city: profile.city,
    countryCode: profile.countryCode,
    lastSeenAt: isSelf || row.showLastSeen !== false ? (profile.lastSeenAt?.toISOString() ?? null) : null,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    activeListingCount: profile.activeListingCount,
    soldCount: profile.soldCount,
    memberReview: member,
    automaticReview: automatic,
    emailVerified: user.emailVerified,
    googleVerified: googleRows.length > 0,
    badges: badgeRows.map((b) => ({ slug: b.slug, icon: b.icon, name: { en: b.nameEn, he: b.nameHe } })),
    holidayMode: isAway(profile.holidayModeEnabled, profile.holidayEndsAt),
    holidayEndsAt: profile.holidayEndsAt?.toISOString() ?? null,
    ...(viewerRows
      ? { viewer: { isFollowing: viewerRows[0].length > 0, isBlocked: viewerRows[1].length > 0 } }
      : {}),
  };
}

/** GET /v1/me */
export async function loadMe(deps: Deps, userId: string): Promise<Me | null> {
  const [row] = await deps.db
    .select({ user: users, language: userSettings.language })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const profile = await loadPublicProfile(deps, userId, userId);
  if (!profile) return null;
  return {
    id: row.user.id,
    email: row.user.email,
    emailVerified: row.user.emailVerified,
    username: row.user.displayUsername ?? row.user.username,
    name: row.user.name,
    locale: (row.language ?? "he") as Locale,
    profile,
    needsOnboarding: !row.user.username,
  };
}

export type { UserSummary };
