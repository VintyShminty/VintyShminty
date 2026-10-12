import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyRequest } from "fastify";

/** Optional auth: a missing, expired or broken session is just "not signed in". */
export async function optionalViewerId(
  app: Pick<FastifyInstance, "auth">,
  request: Pick<FastifyRequest, "headers">,
): Promise<string | undefined> {
  try {
    const session = await app.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    return session?.user.id;
  } catch {
    return undefined;
  }
}
