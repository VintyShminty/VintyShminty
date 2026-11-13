import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestApp,
  cleanupTestUsers,
  databaseUrl,
  signUpTestUser,
  type TestContext,
  type TestPerson,
} from "../test-helpers.js";

describe.skipIf(!databaseUrl)("follow and block", () => {
  let ctx: TestContext;
  let anna: TestPerson;
  let ben: TestPerson;
  const createdIds: string[] = [];

  const call = (method: "GET" | "PUT" | "DELETE", url: string, token?: string) =>
    ctx.app.inject({ method, url, headers: token ? bearer(token) : {} });
  const profile = async (id: string, token: string) => (await call("GET", `/v1/users/${id}`, token)).json();

  beforeAll(async () => {
    ctx = await buildTestApp();
    [anna, ben] = (await Promise.all(
      ["anna", "ben"].map((n) => signUpTestUser(ctx, n, createdIds)),
    )) as TestPerson[];
  });
  afterAll(async () => {
    await cleanupTestUsers(ctx.database, createdIds, { onlyIds: true });
    await ctx.close();
  });

  it("needs a session and refuses yourself", async () => {
    expect((await call("PUT", `/v1/users/${ben.id}/follow`)).statusCode).toBe(401);
    expect((await call("PUT", `/v1/users/${ben.id}/block`)).statusCode).toBe(401);
    expect((await call("PUT", `/v1/users/${anna.id}/follow`, anna.token)).statusCode).toBe(400);
    expect((await call("PUT", `/v1/users/${anna.id}/block`, anna.token)).statusCode).toBe(400);
  });

  it("follows once however many times it is sent, and unfollows the same way", async () => {
    expect((await call("PUT", `/v1/users/${ben.id}/follow`, anna.token)).statusCode).toBe(204);
    expect((await call("PUT", `/v1/users/${ben.id}/follow`, anna.token)).statusCode).toBe(204);
    const seen = await profile(ben.id, anna.token);
    expect(seen.followerCount).toBe(1);
    expect(seen.viewer).toMatchObject({ isFollowing: true, isBlocked: false });
    expect((await profile(anna.id, anna.token)).followingCount).toBe(1);

    expect((await call("DELETE", `/v1/users/${ben.id}/follow`, anna.token)).statusCode).toBe(204);
    expect((await call("DELETE", `/v1/users/${ben.id}/follow`, anna.token)).statusCode).toBe(204);
    expect((await profile(ben.id, anna.token)).followerCount).toBe(0);
    expect((await profile(anna.id, anna.token)).followingCount).toBe(0);
  });

  it("a block removes the follow both ways and stops a new one", async () => {
    await call("PUT", `/v1/users/${ben.id}/follow`, anna.token);
    await call("PUT", `/v1/users/${anna.id}/follow`, ben.token);
    expect((await call("PUT", `/v1/users/${ben.id}/block`, anna.token)).statusCode).toBe(204);
    expect((await call("PUT", `/v1/users/${ben.id}/block`, anna.token)).statusCode).toBe(204);

    const seen = await profile(ben.id, anna.token);
    expect(seen.viewer).toMatchObject({ isFollowing: false, isBlocked: true });
    expect(seen.followerCount).toBe(0);
    expect(seen.followingCount).toBe(0);
    expect((await call("PUT", `/v1/users/${ben.id}/follow`, anna.token)).statusCode).toBe(403);
    expect((await call("PUT", `/v1/users/${anna.id}/follow`, ben.token)).statusCode).toBe(403);

    expect((await call("DELETE", `/v1/users/${ben.id}/block`, anna.token)).statusCode).toBe(204);
    expect((await call("PUT", `/v1/users/${ben.id}/follow`, anna.token)).statusCode).toBe(204);
  });
});
