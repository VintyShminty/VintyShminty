import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { cleanBrands, describeCleanup } from "./brands-cleanup.js";
import { assertDevelopment, connect, databaseUrl } from "./connection.js";
import { seedReference } from "./reference.js";
import { seedSample } from "./sample/index.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

const command = process.argv[2];
const { db, client, close } = connect();

function print(title: string, counts: Record<string, number>) {
  console.log(`\n${title}`);
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table.padEnd(26)} ${count}`);
}

try {
  if (command === "reference") {
    // Reference data is safe anywhere. It only inserts or updates.
    print("Reference data", await seedReference(db));
  } else if (command === "brands-cleanup") {
    // Safe anywhere and safe to run again. Add --dry-run to see what it would do without saving.
    const dryRun = process.argv.includes("--dry-run");
    console.log(`Brand cleanup on ${new URL(databaseUrl()).host}${dryRun ? " (dry run)" : ""}`);
    console.log(describeCleanup(await cleanBrands(db, { dryRun }), dryRun).join("\n"));
  } else if (command === "seed") {
    assertDevelopment("seed sample data");
    print("Reference data", await seedReference(db));
    print("Sample data", await seedSample(db));
  } else if (command === "reset") {
    assertDevelopment("reset the database");
    console.log(`Resetting ${new URL(databaseUrl()).pathname.slice(1)} on ${new URL(databaseUrl()).host}`);
    await client`drop schema if exists public cascade`;
    await client`drop schema if exists drizzle cascade`;
    await client`create schema public`;
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied");
    print("Reference data", await seedReference(db));
    print("Sample data", await seedSample(db));
  } else {
    console.error("Usage: cli.ts <reference | brands-cleanup | seed | reset>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause) console.error("Cause:", error.cause);
  process.exitCode = 1;
} finally {
  await close();
}
