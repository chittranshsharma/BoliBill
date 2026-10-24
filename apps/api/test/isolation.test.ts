import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:54329/bolibill_test";
process.env.BETTER_AUTH_SECRET = "test-only-secret-abcdefghijklmnopqrstuvwxyz-123456";

const { auth } = await import("../src/auth.js");
const { db, pool } = await import("../src/db.js");
const { buildApp } = await import("../src/app.js");
const { getMigrations } = await import("better-auth/db/migration");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const app = buildApp();
const origin = "http://127.0.0.1:3000";

beforeAll(async () => {
  await (await getMigrations(auth.options)).runMigrations();
  await migrate(db, { migrationsFolder: "./drizzle" });
  await app.ready();
});
afterAll(async () => { await app.close(); await pool.end(); });

async function createAccount() {
  const email = `${randomUUID()}@example.test`;
  const response = await app.inject({ method: "POST", url: "/api/auth/sign-up/email", headers: { origin }, payload: { name: "Test User", email, password: "test-password-12345" } });
  expect(response.statusCode).toBe(200);
  const setCookie = response.headers["set-cookie"];
  expect(setCookie).toBeDefined();
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie as string).split(";")[0];
  return { email, cookie };
}

async function createShop(cookie: string, name: string) {
  const response = await app.inject({ method: "POST", url: "/api/shops", headers: { origin, cookie }, payload: { name } });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string };
}

describe("shop isolation and catalog authorization", () => {
  it("keeps shops separate, restricts edits to owners, and stores Hindi names", async () => {
    expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
    const alice = await createAccount();
    const bob = await createAccount();
    const first = await createShop(alice.cookie, "First Shop");
    const second = await createShop(bob.cookie, "Second Shop");
    const created = await app.inject({ method: "POST", url: `/api/shops/${first.id}/products`, headers: { origin, cookie: alice.cookie }, payload: { sku: "RICE-01", name: "चावल", alias: "Chawal", unit: "kg", pricePaise: 12550 } });
    expect(created.statusCode).toBe(201);
    const product = created.json() as { id: string };
    const duplicateSku = await app.inject({ method: "POST", url: `/api/shops/${first.id}/products`, headers: { origin, cookie: alice.cookie }, payload: { sku: "RICE-01", name: "Another rice", unit: "kg", pricePaise: 20000 } });
    expect(duplicateSku.statusCode).toBe(409);
    const rejectedOrigin = await app.inject({ method: "POST", url: `/api/shops/${first.id}/products`, headers: { origin: "http://untrusted.example", cookie: alice.cookie }, payload: { sku: "BAD", name: "Bad", unit: "each", pricePaise: 100 } });
    expect(rejectedOrigin.statusCode).toBe(403);
    const malformed = await app.inject({ method: "POST", url: `/api/shops/${first.id}/products`, headers: { origin, cookie: alice.cookie, "content-type": "application/json" }, payload: "{" });
    expect(malformed.statusCode).toBe(400);

    const aliceList = await app.inject({ method: "GET", url: `/api/shops/${first.id}/products`, headers: { cookie: alice.cookie } });
    expect(aliceList.json()[0].name).toBe("चावल");
    const bobList = await app.inject({ method: "GET", url: `/api/shops/${second.id}/products`, headers: { cookie: bob.cookie } });
    expect(bobList.json()).toEqual([]);
    const crossRead = await app.inject({ method: "GET", url: `/api/shops/${first.id}/products`, headers: { cookie: bob.cookie } });
    expect(crossRead.statusCode).toBe(404);
    const crossWrite = await app.inject({ method: "PATCH", url: `/api/shops/${first.id}/products/${product.id}`, headers: { origin, cookie: bob.cookie }, payload: { pricePaise: 1 } });
    expect(crossWrite.statusCode).toBe(404);
    const wrongShopProduct = await app.inject({ method: "PATCH", url: `/api/shops/${second.id}/products/${product.id}`, headers: { origin, cookie: bob.cookie }, payload: { pricePaise: 1 } });
    expect(wrongShopProduct.statusCode).toBe(404);

    const addCashier = await app.inject({ method: "POST", url: `/api/shops/${first.id}/memberships`, headers: { origin, cookie: alice.cookie }, payload: { email: bob.email, role: "cashier" } });
    expect(addCashier.statusCode).toBe(200);
    const removeOwnAccess = await app.inject({ method: "POST", url: `/api/shops/${first.id}/memberships`, headers: { origin, cookie: alice.cookie }, payload: { email: alice.email, role: "cashier" } });
    expect(removeOwnAccess.statusCode).toBe(400);
    const cashierRead = await app.inject({ method: "GET", url: `/api/shops/${first.id}/products`, headers: { cookie: bob.cookie } });
    expect(cashierRead.statusCode).toBe(200);
    const cashierWrite = await app.inject({ method: "PATCH", url: `/api/shops/${first.id}/products/${product.id}`, headers: { origin, cookie: bob.cookie }, payload: { pricePaise: 1 } });
    expect(cashierWrite.statusCode).toBe(404);
    const finalRead = await app.inject({ method: "GET", url: `/api/shops/${first.id}/products`, headers: { cookie: alice.cookie } });
    expect(finalRead.json()[0].pricePaise).toBe(12550);
  });
});
