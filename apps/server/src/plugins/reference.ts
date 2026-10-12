import fp from "fastify-plugin";
import { createReferenceCache, type ReferenceCache } from "../lib/reference.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Categories, sizes, conditions and the rest, kept in memory for a minute. */
    reference: ReferenceCache;
  }
}

export default fp(
  async (app) => {
    app.decorate("reference", createReferenceCache(app.db));
  },
  { name: "reference", dependencies: ["db"] },
);
