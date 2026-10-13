import { createDb } from "@vinty/db";
import { buildApp } from "./app.js";
import { parseEnv } from "./env.js";

const env = parseEnv();
const database = createDb(env.DATABASE_URL, {
  max: env.DATABASE_POOL_MAX,
  prepare: env.DATABASE_PREPARED_STATEMENTS,
});
const app = await buildApp({ env, database });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
