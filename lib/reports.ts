import type { Account, Transaction } from "../domain/finance/types.ts";

export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthlyReport(transactions: Transaction[], month: string) {
  const rows = transactions.filter(row => row.date.startsWith(month));
  const income = rows.filter(row => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
  const expense = rows.filter(row => row.type === "expense").reduce((sum, row) => sum + row.amount, 0);
  const categories = new Map<string, number>();
  for (const row of rows) {
    if (row.type === "expense") categories.set(row.category, (categories.get(row.category) || 0) + row.amount);
  }
  return {
    month, income, expense, net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income * 100 : null,
    count: rows.length,
    categories: [...categories].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export function monthlyTrend(transactions: Transaction[], month: string) {
  return Array.from({ length: 6 }, (_, index) => monthlyReport(transactions, shiftMonth(month, index - 5)));
}

export function percentageChange(current: number, previous: number) {
  return previous > 0 ? (current - previous) / previous * 100 : null;
}

export type TransactionSort = "newest" | "oldest" | "largest" | "smallest";
export function searchTransactions(rows: Transaction[], accounts: Account[], query: string) {
  const term = query.trim().toLocaleLowerCase("id-ID");
  const names = new Map(accounts.map(account => [account.id, account.name]));
  return rows.filter(row => [row.note, row.merchant, row.category, names.get(row.accountId), names.get(row.toAccountId || "")]
    .join(" ").toLocaleLowerCase("id-ID").includes(term));
}
export function sortTransactions(rows: Transaction[], sort: TransactionSort) {
  return [...rows].sort((a, b) => {
    const newest = b.date.localeCompare(a.date) || (b.createdAt || b.queuedAt || "").localeCompare(a.createdAt || a.queuedAt || "") || a.id.localeCompare(b.id);
    if (sort === "oldest") return -newest;
    if (sort === "largest") return Math.abs(b.amount) - Math.abs(a.amount) || newest;
    if (sort === "smallest") return Math.abs(a.amount) - Math.abs(b.amount) || newest;
    return newest;
  });
}
