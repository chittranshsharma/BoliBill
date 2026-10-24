import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.url().default("postgres://postgres:postgres@127.0.0.1:54329/bolibill"),
  BETTER_AUTH_SECRET: z.string().min(32),
  API_ORIGIN: z.url().default("http://127.0.0.1:4000"),
  WEB_ORIGIN: z.url().default("http://127.0.0.1:3000"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export const config = configSchema.parse(process.env);
