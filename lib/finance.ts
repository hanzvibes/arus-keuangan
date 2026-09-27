export type FinanceAccount = { id: string; openingBalance: number };
export type FinanceTransaction = { type: "income" | "expense" | "transfer" | "adjustment"; amount: number; accountId: string; toAccountId: string | null; category: string; date: string };
export type FinanceBudget = { category: string; amount: number };
export const ADJUSTMENT_CATEGORY = "Penyesuaian Saldo";

/** A signed ledger entry; zero means the balances already match. */
export function reconciliationDelta(recorded: number, actual: number): number | null {
  if (!Number.isSafeInteger(recorded) || !Number.isSafeInteger(actual)) return null;
  const difference = actual - recorded;
  return Number.isSafeInteger(difference) && Math.abs(difference) <= 1_000_000_000_000 ? difference : null;
}

export function accountBalance(account: FinanceAccount, transactions: FinanceTransaction[]) {
  return account.openingBalance + transactions.reduce((sum, t) =>
    sum + (t.type === "income" && t.accountId === account.id ? t.amount : 0)
      - (t.type === "expense" && t.accountId === account.id ? t.amount : 0)
      - (t.type === "transfer" && t.accountId === account.id ? t.amount : 0)
      + (t.type === "transfer" && t.toAccountId === account.id ? t.amount : 0)
      + (t.type === "adjustment" && t.accountId === account.id ? t.amount : 0), 0);
}

export function budgetSummary(budgets: FinanceBudget[], transactions: FinanceTransaction[], month: string) {
  const total = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const categories = new Set(budgets.map(budget => budget.category));
  const spent = transactions.filter(t => t.type === "expense" && t.date.startsWith(month) && categories.has(t.category))
    .reduce((sum, t) => sum + t.amount, 0);
  return { total, spent, percent: total ? Math.round(spent / total * 100) : 0 };
}
