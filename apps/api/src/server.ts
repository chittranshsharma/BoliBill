import { buildApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";

const app = buildApp();
try {
  await pool.query("select 1");
  await app.listen({ host: "127.0.0.1", port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
