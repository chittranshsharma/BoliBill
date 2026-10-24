import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "./auth.js";
import { db, pool } from "./db.js";

try {
  const authMigrations = await getMigrations(auth.options);
  await authMigrations.runMigrations();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Auth and application migrations applied.");
} finally {
  await pool.end();
}
