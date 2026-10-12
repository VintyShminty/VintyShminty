import type { Database } from "@vinty/db";
import fp from "fastify-plugin";

/**
 * What the server needs from the database. The real one comes from createDb in @vinty/db.
 * `db` (the query builder) is optional only so the health tests can pass a fake with just ping and close.
 */
export type DatabaseHandle = Pick<Database, "ping" | "close"> & Partial<Pick<Database, "db">>;

declare module "fastify" {
  interface FastifyInstance {
    database: DatabaseHandle;
  }
}

export default fp<{ database: DatabaseHandle }>(
  async (app, opts) => {
    app.decorate("database", opts.database);
    app.addHook("onClose", async () => {
      await opts.database.close();
    });
  },
  { name: "db" },
);
