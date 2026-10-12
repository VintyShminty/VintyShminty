import type { Database } from "@vinty/db";
import fp from "fastify-plugin";

/** What the server needs from the database. The real one comes from createDb in @vinty/db. */
export type DatabaseHandle = Pick<Database, "ping" | "close">;

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
