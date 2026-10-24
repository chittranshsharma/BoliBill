import { pgTable, text, timestamp, primaryKey, uniqueIndex, integer, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const shops = pgTable("shops", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  upiId: text("upi_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  shopId: text("shop_id").notNull().references(() => shops.id),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["owner", "cashier"] }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.shopId, table.userId] }),
  check("memberships_role_check", sql`${table.role} in ('owner', 'cashier')`),
]);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull().references(() => shops.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  alias: text("alias"),
  unit: text("unit", { enum: ["each", "kg", "g", "l", "ml"] }).notNull(),
  pricePaise: integer("price_paise").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("products_shop_sku_unique").on(table.shopId, table.sku),
  uniqueIndex("products_shop_id_unique").on(table.shopId, table.id),
  check("products_price_nonnegative", sql`${table.pricePaise} >= 0`),
  check("products_unit_check", sql`${table.unit} in ('each', 'kg', 'g', 'l', 'ml')`),
]);
