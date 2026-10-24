import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "./auth.js";
import { config } from "./config.js";
import { db, pool } from "./db.js";
import { memberships, products, shops } from "./schema.js";

const shopInput = z.object({ name: z.string().trim().min(2).max(120), address: z.string().trim().max(500).optional() });
const productInput = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  alias: z.string().trim().max(160).optional(),
  unit: z.enum(["each", "kg", "g", "l", "ml"]),
  pricePaise: z.number().int().min(0).max(100_000_000),
});
const productUpdate = productInput.partial().extend({ active: z.boolean().optional() });
const searchInput = z.object({ q: z.string().trim().max(100).default("") });
const memberInput = z.object({ email: z.email().transform((value) => value.toLowerCase()), role: z.enum(["owner", "cashier"]) });

function error(reply: FastifyReply, status: number, code: string, message: string, requestId: string) {
  return reply.status(status).send({ error: { code, message, requestId, retryable: status >= 500 } });
}

async function userId(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    error(reply, 401, "UNAUTHENTICATED", "Sign in to continue.", request.id);
    return null;
  }
  return session.user.id;
}

async function member(request: FastifyRequest, reply: FastifyReply, shopId: string, owner = false) {
  const id = await userId(request, reply);
  if (!id) return null;
  const [membership] = await db.select().from(memberships).where(and(eq(memberships.shopId, shopId), eq(memberships.userId, id))).limit(1);
  if (!membership || (owner && membership.role !== "owner")) {
    error(reply, 404, "NOT_FOUND", "Shop or resource not found.", request.id);
    return null;
  }
  return membership;
}

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV === "test" ? false : { redact: ["req.headers.cookie", "req.headers.authorization", "req.body"] }, bodyLimit: 64 * 1024 });
  app.register(cors, { origin: config.WEB_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });

  app.addHook("preHandler", async (request, reply) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && origin !== config.WEB_ORIGIN && origin !== config.API_ORIGIN) {
        return error(reply, 403, "ORIGIN_REJECTED", "Request origin is not allowed.", request.id);
      }
    }
  });

  app.setErrorHandler((cause, request, reply) => {
    request.log.error({ err: cause }, "Request failed");
    const databaseError = cause as { code?: string; cause?: { code?: string } };
    if (databaseError.code === "23505" || databaseError.cause?.code === "23505") return error(reply, 409, "CONFLICT", "This value already exists for the shop.", request.id);
    if ((cause as { statusCode?: number }).statusCode === 400) return error(reply, 400, "VALIDATION_ERROR", "Request body is invalid.", request.id);
    return error(reply, 500, "INTERNAL_ERROR", "The request could not be completed.", request.id);
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (request, reply) => {
    try {
      await pool.query("select 1");
      return reply.send({ status: "ready" });
    } catch {
      return error(reply, 503, "DATABASE_UNAVAILABLE", "Database is unavailable.", request.id);
    }
  });
  app.route({ method: ["GET", "POST"], url: "/api/auth/*", async handler(request, reply) {
    const url = new URL(request.url, config.API_ORIGIN);
    const response = await auth.handler(new Request(url, {
      method: request.method,
      headers: fromNodeHeaders(request.headers),
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    }));
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(response.body ? await response.text() : null);
  }});

  app.get("/api/shops", async (request, reply) => {
    const id = await userId(request, reply);
    if (!id) return;
    return db.select({ id: shops.id, name: shops.name, address: shops.address, role: memberships.role })
      .from(memberships).innerJoin(shops, eq(memberships.shopId, shops.id)).where(eq(memberships.userId, id));
  });

  app.post("/api/shops", async (request, reply) => {
    const id = await userId(request, reply);
    if (!id) return;
    const parsed = shopInput.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, "VALIDATION_ERROR", "Enter a valid shop name and address.", request.id);
    const shop = await db.transaction(async (tx) => {
      const [created] = await tx.insert(shops).values({ id: randomUUID(), ...parsed.data }).returning();
      await tx.insert(memberships).values({ shopId: created.id, userId: id, role: "owner" });
      return created;
    });
    return reply.status(201).send(shop);
  });

  app.get<{ Params: { shopId: string } }>("/api/shops/:shopId/memberships", async (request, reply) => {
    if (!await member(request, reply, request.params.shopId, true)) return;
    const result = await pool.query<{ user_id: string; name: string; email: string; role: string }>(
      'select m.user_id, u.name, u.email, m.role from memberships m join "user" u on u.id = m.user_id where m.shop_id = $1 order by u.email',
      [request.params.shopId],
    );
    return result.rows;
  });

  app.post<{ Params: { shopId: string } }>("/api/shops/:shopId/memberships", async (request, reply) => {
    const owner = await member(request, reply, request.params.shopId, true);
    if (!owner) return;
    const parsed = memberInput.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, "VALIDATION_ERROR", "Enter an existing account email and a valid role.", request.id);
    const account = await pool.query<{ id: string }>('select id from "user" where lower(email) = $1 limit 1', [parsed.data.email]);
    const target = account.rows[0];
    if (!target) return error(reply, 404, "NOT_FOUND", "Account not found. Ask the cashier to create an account first.", request.id);
    if (target.id === owner.userId && parsed.data.role !== "owner") return error(reply, 400, "LAST_OWNER", "You cannot remove your own owner access.", request.id);
    await db.insert(memberships).values({ shopId: request.params.shopId, userId: target.id, role: parsed.data.role })
      .onConflictDoUpdate({ target: [memberships.shopId, memberships.userId], set: { role: parsed.data.role } });
    return reply.status(200).send({ userId: target.id, role: parsed.data.role });
  });

  app.get<{ Params: { shopId: string }; Querystring: { q?: string } }>("/api/shops/:shopId/products", async (request, reply) => {
    if (!await member(request, reply, request.params.shopId)) return;
    const parsed = searchInput.safeParse(request.query);
    if (!parsed.success) return error(reply, 400, "VALIDATION_ERROR", "Invalid search.", request.id);
    const scope = eq(products.shopId, request.params.shopId);
    const term = parsed.data.q.replace(/[\\%_]/g, "\\$&");
    const predicate = term ? and(scope, or(ilike(products.name, `%${term}%`), ilike(products.sku, `%${term}%`), ilike(products.alias, `%${term}%`))) : scope;
    return db.select().from(products).where(predicate).limit(100);
  });

  app.post<{ Params: { shopId: string } }>("/api/shops/:shopId/products", async (request, reply) => {
    if (!await member(request, reply, request.params.shopId, true)) return;
    const parsed = productInput.safeParse(request.body);
    if (!parsed.success) return error(reply, 400, "VALIDATION_ERROR", "Enter a valid product, unit, and price in paise.", request.id);
    const [created] = await db.insert(products).values({ id: randomUUID(), shopId: request.params.shopId, ...parsed.data }).returning();
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { shopId: string; productId: string } }>("/api/shops/:shopId/products/:productId", async (request, reply) => {
    if (!await member(request, reply, request.params.shopId, true)) return;
    const parsed = productUpdate.safeParse(request.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) return error(reply, 400, "VALIDATION_ERROR", "Enter at least one valid product field.", request.id);
    const [updated] = await db.update(products).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(products.shopId, request.params.shopId), eq(products.id, request.params.productId))).returning();
    if (!updated) return error(reply, 404, "NOT_FOUND", "Shop or resource not found.", request.id);
    return updated;
  });

  return app;
}
