import test from "node:test";
import assert from "node:assert/strict";
import { accountBalance, budgetSummary, reconciliationDelta, ADJUSTMENT_CATEGORY } from "../lib/finance.ts";
import { parseQuickEntry } from "../lib/quick-entry.ts";
import { validateBackup } from "../lib/backup.ts";
import { nextOccurrence } from "../lib/recurring.ts";

test("transfer moves money without changing the combined balance", () => {
  const accounts = [{ id: "a", openingBalance: 1000 }, { id: "b", openingBalance: 500 }];
  const transactions = [
    { type: "transfer", amount: 200, accountId: "a", toAccountId: "b", category: "Transfer", date: "2026-09-27" },
    { type: "expense", amount: 50, accountId: "b", toAccountId: null, category: "Makanan & Minuman", date: "2026-09-27" },
    { type: "income", amount: 100, accountId: "a", toAccountId: null, category: "Gaji", date: "2026-09-27" },
  ];
  assert.equal(accountBalance(accounts[0], transactions), 900);
  assert.equal(accountBalance(accounts[1], transactions), 650);
  assert.equal(accounts.reduce((sum, account) => sum + accountBalance(account, transactions), 0), 1550);
});

test("budget progress excludes unbudgeted categories and other months", () => {
  const budgets = [{ category: "Makanan & Minuman", amount: 400 }];
  const transactions = [
    { type: "expense", amount: 100, category: "Makanan & Minuman", date: "2026-09-27", accountId: "a", toAccountId: null },
    { type: "expense", amount: 300, category: "Transportasi", date: "2026-09-27", accountId: "a", toAccountId: null },
    { type: "expense", amount: 200, category: "Makanan & Minuman", date: "2026-08-27", accountId: "a", toAccountId: null },
  ];
  assert.deepEqual(budgetSummary(budgets, transactions, "2026-09"), { total: 400, spent: 100, percent: 25 });
});

test("reconciliation moves the account to its actual balance without changing cashflow or budgets", () => {
  const account = { id: "a", openingBalance: 1000 };
  const transactions = [
    { type: "income", amount: 250, accountId: "a", toAccountId: null, category: "Gaji", date: "2026-09-27" },
    { type: "expense", amount: 100, accountId: "a", toAccountId: null, category: "Makanan & Minuman", date: "2026-09-27" },
  ];
  const recorded = accountBalance(account, transactions);
  const debit = reconciliationDelta(recorded, 950);
  assert.equal(debit, -200);
  const withDebit = [...transactions, { type: "adjustment", amount: debit, accountId: "a", toAccountId: null, category: ADJUSTMENT_CATEGORY, date: "2026-09-27" }];
  assert.equal(accountBalance(account, withDebit), 950);
  assert.deepEqual(budgetSummary([{ category: "Makanan & Minuman", amount: 500 }], withDebit, "2026-09"), { total: 500, spent: 100, percent: 20 });
  const credit = reconciliationDelta(accountBalance(account, withDebit), 1200);
  assert.equal(credit, 250);
  assert.equal(accountBalance(account, [...withDebit, { ...withDebit.at(-1), amount: credit }]), 1200);
  assert.equal(reconciliationDelta(1200, 1200), 0);
  assert.equal(reconciliationDelta(0, 1_000_000_000_001), null);
});

test("quick entry parses rupiah shorthand and requires one amount", () => {
  assert.deepEqual(parseQuickEntry("beli kopi 25rb").entry, { type: "expense", amount: 25000, category: "Makanan & Minuman", note: "beli kopi" });
  assert.equal(parseQuickEntry("terima gaji 4,5 juta").entry?.amount, 4500000);
  assert.equal(parseQuickEntry("kopi 25rb dan roti 10rb").entry, undefined);
});

test("backup accepts linked records and rejects missing accounts", () => {
  const backup = {
    version: 1, exportedAt: "2026-09-27T00:00:00Z",
    accounts: [{ id: "a", name: "Cash", kind: "cash", openingBalance: 1000, createdAt: "2026-09-27T00:00:00Z" }],
    budgets: [{ id: "b", category: "Makanan & Minuman", amount: 500, createdAt: "2026-09-27T00:00:00Z" }],
    transactions: [{ id: "t", type: "expense", amount: 100, accountId: "a", toAccountId: null, category: "Makanan & Minuman", note: "Kopi", date: "2026-09-27", createdAt: "2026-09-27T00:00:00Z" }],
  };
  assert.ok(validateBackup(backup).data);
  assert.match(validateBackup({ ...backup, transactions: [{ ...backup.transactions[0], accountId: "missing" }] }).error, /akun/i);
  assert.match(validateBackup({ ...backup, transactions: [{ ...backup.transactions[0], date: "2026-02-31" }] }).error, /transaksi/i);
  assert.deepEqual(validateBackup(backup).data.categories, []);
  const upgraded = { ...backup, version: 2, categories: [{ id: "c", name: "Kucing", createdAt: backup.exportedAt }], recurring: [{ id: "r", type: "expense", amount: 50, accountId: "a", toAccountId: null, category: "Kucing", note: "Pakan", nextDate: "2026-10-31", frequency: "monthly", anchorDay: 31, active: 1, createdAt: backup.exportedAt }] };
  assert.equal(validateBackup(upgraded).data.recurring.length, 1);
  assert.match(validateBackup({ ...upgraded, recurring: [{ ...upgraded.recurring[0], accountId: "missing" }] }).error, /akun/i);
  assert.match(validateBackup({ ...upgraded, categories: [{ ...upgraded.categories[0], name: "Gaji" }] }).error, /kategori/i);
  const adjustment = { id: "adj", type: "adjustment", amount: -200, accountId: "a", toAccountId: null, category: ADJUSTMENT_CATEGORY, note: "Cek saldo bank", date: "2026-09-27", createdAt: backup.exportedAt };
  assert.ok(validateBackup({ ...upgraded, transactions: [...backup.transactions, adjustment] }).data);
  assert.match(validateBackup({ ...upgraded, transactions: [{ ...adjustment, note: "" }] }).error, /transaksi/i);
  assert.match(validateBackup({ ...upgraded, transactions: [{ ...adjustment, category: "Gaji" }] }).error, /transaksi/i);
});

test("monthly schedules retain their original day across short months", () => {
  assert.equal(nextOccurrence("2027-01-31", "monthly", 31), "2027-02-28");
  assert.equal(nextOccurrence("2027-02-28", "monthly", 31), "2027-03-31");
  assert.equal(nextOccurrence("2028-01-31", "monthly", 31), "2028-02-29");
  assert.equal(nextOccurrence("2026-12-31", "monthly", 31), "2027-01-31");
  assert.equal(nextOccurrence("2026-09-27", "weekly", 27), "2026-10-04");
});
