import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  openingBalance: integer("opening_balance").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  toAccountId: text("to_account_id").references(() => accounts.id),
  category: text("category").notNull(),
  note: text("note").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  createdAt: text("created_at").notNull(),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const recurring = sqliteTable("recurring", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  toAccountId: text("to_account_id").references(() => accounts.id),
  category: text("category").notNull(),
  note: text("note").notNull(),
  nextDate: text("next_date").notNull(),
  frequency: text("frequency").notNull(),
  anchorDay: integer("anchor_day").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
