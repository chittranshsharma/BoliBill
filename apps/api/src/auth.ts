import { betterAuth } from "better-auth";
import { pool } from "./db.js";
import { config } from "./config.js";

export const auth = betterAuth({
  database: pool,
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.API_ORIGIN,
  trustedOrigins: [config.WEB_ORIGIN],
  emailAndPassword: { enabled: true },
});
