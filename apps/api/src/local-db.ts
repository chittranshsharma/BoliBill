import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const databaseDir = resolve("data/db-utf8");
mkdirSync(resolve("data"), { recursive: true });
const postgres = new EmbeddedPostgres({ databaseDir, user: "postgres", password: "postgres", port: 54329, persistent: true, initdbFlags: ["--encoding=UTF8"] });
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await postgres.initialise();
await postgres.start();

const client = postgres.getPgClient();
await client.connect();
try {
  for (const name of ["bolibill", "bolibill_test"]) {
    const result = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (result.rowCount === 0) await postgres.createDatabase(name);
  }
} finally {
  await client.end();
}
console.log("Local PostgreSQL ready at 127.0.0.1:54329; press Ctrl+C to stop.");
process.on("SIGINT", async () => { await postgres.stop(); process.exit(0); });
process.on("SIGTERM", async () => { await postgres.stop(); process.exit(0); });
await new Promise(() => {});
