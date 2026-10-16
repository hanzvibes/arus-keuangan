import test from "node:test";
import assert from "node:assert/strict";
import { monthlyTools, monthlyTransactionsCsv } from "../src/lib/monthly-tools.ts";
import { parseCsvTransactions } from "../src/lib/client-productivity.ts";

const rows = [
  { id: "1", type: "expense", amount: 120, accountId: "a", toAccountId: null, category: "Makan", note: 'Nasi, "ayam"', date: "2026-10-02" },
  { id: "2", type: "expense", amount: 80, accountId: "a", toAccountId: null, category: "Makan", note: "Kopi", date: "2026-10-04" },
  { id: "3", type: "income", amount: 500, accountId: "a", toAccountId: null, category: "Gaji", note: "", date: "2026-10-01" },
  { id: "4", type: "expense", amount: 100, accountId: "a", toAccountId: null, category: "Makan", note: "September", date: "2026-09-04" },
];

test("monthly tools use elapsed days, selected month, and category budget", () => {
  const result = monthlyTools(rows, [{ id: "b", category: "Makan", amount: 300 }], "2026-10", "2026-10-05");
  assert.equal(result.average, 40);
  assert.equal(result.projection, 1240);
  assert.equal(result.noSpendDays, 3);
  assert.equal(result.biggest.id, "1");
  assert.equal(result.topCategoryShare, 100);
  assert.equal(result.budgetRemaining, 100);
  assert.equal(result.expenseChange, 100);
  assert.deepEqual(result.daily.slice(0, 5), [0, 120, 0, 80, 0]);
});

test("future months and empty data avoid false projections", () => {
  const result = monthlyTools([], [], "2026-11", "2026-10-05");
  assert.equal(result.elapsedDays, 0);
  assert.equal(result.projection, 0);
  assert.equal(result.noSpendDays, 0);
  assert.equal(result.expenseChange, null);
});

test("future-dated expenses do not inflate today's daily average", () => {
  const future = { ...rows[0], id: "future", amount: 1000, date: "2026-10-20" };
  const result = monthlyTools([...rows, future], [], "2026-10", "2026-10-05");
  assert.equal(result.average, 40);
  assert.equal(result.projection, 1240);
});

test("monthly CSV escapes commas and quotes and excludes other months", () => {
  const csv = monthlyTransactionsCsv(rows, "2026-10");
  assert.match(csv, /"Nasi, ""ayam"""/);
  assert.doesNotMatch(csv, /September/);
  assert.equal(csv.split("\r\n").length, 4);
  const parsed = parseCsvTransactions(`\uFEFF${csv}`);
  assert.equal(parsed.valid.length, 3);
  assert.equal(parsed.valid[0].note, 'Nasi, "ayam"');
});
